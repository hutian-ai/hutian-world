import { ServerClient, loadClientOptions } from '@harness-dock/client';
import { readFile, stat, mkdir, open } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { parseArgs } from 'node:util';

// Hutian's trusted application policy answers native approval callbacks; it never edits native settings.
// The stock-report policy permits only exact, known read-only MCP methods on the selected Runtime.
const readonlyFutu = new Set([
  'quote_trading_days', 'quote_market_state', 'quote_market_snapshot', 'quote_stock_quote',
  'quote_history_kline', 'quote_cur_kline', 'quote_stock_basicinfo', 'quote_user_security', 'quote_user_security_group',
  'quote_owner_plate', 'quote_plate_list', 'quote_plate_stock', 'quote_financials_statements', 'quote_financials_revenue_breakdown',
  'quote_valuation_detail', 'quote_research_analyst_consensus', 'quote_corporate_actions_rehab', 'quote_corporate_actions_dividends',
  'quote_corporate_actions_stock_splits', 'quote_short_interest', 'quote_daily_short_volume', 'news_search',
  'quote_economic_calendar_search', 'quote_economic_calendar_hot',
]);
process.umask(0o077);
let client, remove;
let attempted = false;
let identity;
const controller = new AbortController();
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { controller.abort(); void client?.close(); });
try {
  const { positionals: [command, configPath, ...extra], values } = parseArgs({ allowPositionals: true, options: {
    'node-id': { type: 'string' }, provider: { type: 'string' }, model: { type: 'string' },
    'run-id': { type: 'string' }, 'prompt-file': { type: 'string' }, receipt: { type: 'string' }, 'timeout-ms': { type: 'string' },
  } });
  if (extra.length || command !== 'run' || !configPath || !values['node-id'] || !values['run-id'] || !values['prompt-file'] || !values.receipt) throw new Error('task_request_invalid');
  const uuid = /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i;
  if (!uuid.test(values['run-id']) || !uuid.test(values['node-id'])) throw new Error('task_identity_invalid');
  const policyPath = new URL('../../../.local/task-approval-policy.json', import.meta.url);
  const policyInfo = await stat(policyPath);
  if (!policyInfo.isFile() || policyInfo.mode & 0o077 || policyInfo.size > 16384) throw new Error('task_policy_unavailable');
  const policy = JSON.parse(await readFile(policyPath, 'utf8'));
  if (policy.server !== 'futu' || !Array.isArray(policy.tools) || !policy.tools.every(name => readonlyFutu.has(name))) throw new Error('task_policy_invalid');
  const policyApplies = policy.nodeId === values['node-id'] && policy.provider === values.provider;
  const input = { provider: values.provider, runId: values['run-id'], prompt: await readFile(values['prompt-file'], 'utf8'), ...(values.model ? { model: values.model } : {}) };
  if (!input.prompt.trim() || Buffer.byteLength(input.prompt) > 8 * 1024 * 1024) throw new Error('task_prompt_invalid');
  const timeoutMs = Number(values['timeout-ms'] ?? 3600000);
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 180000 || timeoutMs > 3600000) throw new Error('task_wait_invalid');
  const options = await loadClientOptions(configPath);
  identity = { runId: input.runId, nodeId: values['node-id'], provider: input.provider, receipt: resolve(values.receipt) };
  await mkdir(dirname(identity.receipt), { recursive: true, mode: 0o700 });
  const file = await open(identity.receipt, 'wx', 0o600);
  try { await file.writeFile(JSON.stringify({ version: 1, clientId: options.clientId, nodeId: identity.nodeId, runId: input.runId, createdAt: new Date().toISOString(), input })); await file.sync(); }
  finally { await file.close(); }
  client = new ServerClient(options); await client.ready;
  const peer = client.node(identity.nodeId), boot = peer?.daemonId;
  if (!peer?.connected || !boot) throw new Error('task_runtime_unavailable');
  const fence = signal => { controller.signal.throwIfAborted(); signal?.throwIfAborted(); if (!peer.connected || peer.daemonId !== boot) throw new Error('task_runtime_changed'); };
  const calls = new Map();
  remove = peer.onExecutionCallback(async (call, context) => {
    fence(context.signal);
    if (call.runId !== input.runId || context.nodeId !== peer.nodeId || context.daemonId !== boot) throw new Error('task_callback_mismatch');
    console.error(JSON.stringify(call));
    if (call.kind === 'event') {
      const event = call.payload;
      // ACP publishes structured tool_call metadata before asking permission; the formal Codex item may arrive afterwards.
      if (event?.type === 'tool_call' && typeof event.toolCallId === 'string') {
        if (event.tag === 'tool_call' && event.status === 'in_progress' && typeof event.rawInput?.server === 'string' && typeof event.rawInput?.tool === 'string')
          calls.set(event.toolCallId, { server: event.rawInput.server, tool: event.rawInput.tool });
        else if (['completed', 'failed', 'cancelled'].includes(event.status)) calls.delete(event.toolCallId);
      }
      const item = event?.type === 'codex_event' && event.kind === 'item' ? event.item : null;
      if (item?.type === 'mcpToolCall' && typeof item.id === 'string') {
        if (event.stage === 'started' && item.status === 'inProgress') calls.set(item.id, { server: item.server, tool: item.tool });
        else if (event.stage === 'completed') calls.delete(item.id);
      }
    }
    if (call.kind === 'permission') {
      const payload = call.payload;
      const requested = calls.get(payload?.details?.toolCallId);
      const allow = policyApplies && requested?.server === policy.server && policy.tools.includes(requested.tool) && payload.canAllow === true &&
        Array.isArray(payload.options) && payload.options.some(option => option.optionId === 'allow_once' && option.kind === 'allow_once');
      console.error(JSON.stringify({ phase: 'task_approval', runId: input.runId, tool: requested?.tool ?? null, server: requested?.server ?? null, decision: allow ? 'allow_once' : 'deny' }));
      return allow ? { optionId: 'allow_once' } : 'deny';
    }
    if (call.kind === 'toolCall') throw new Error('caller_tool_unavailable');
    return null;
  });
  fence();
  const inventory = await peer.request('inventory', {}, 120000); fence();
  const provider = inventory.providers?.find(p => p.key === input.provider);
  if (inventory.nodeId !== peer.nodeId || inventory.daemonId !== boot || provider?.status !== 'ready' || input.model && !provider.models?.includes(input.model)) throw new Error('task_provider_unavailable');
  await peer.request('prepare', { runId: input.runId, files: [] }); fence();
  attempted = true;
  const response = await peer.request('execute', input, timeoutMs); fence();
  if (response.provider !== input.provider || !['completed', 'failed', 'cancelled', 'unknown'].includes(response.result?.state)) throw new Error('task_response_invalid');
  console.log(JSON.stringify({ ...identity, state: response.result.state, result: response.result }));
  process.exitCode = response.result.state === 'completed' ? 0 : response.result.state === 'unknown' ? 2 : 1;
} catch {
  console.log(JSON.stringify({ ...identity, ...(attempted ? { state: 'unknown' } : { state: null, submission: 'not_submitted' }), error: 'task_execution_unconfirmed' }));
  process.exitCode = attempted ? 2 : 1;
} finally { remove?.(); await client?.close(); }
