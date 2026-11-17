import {
  KnowledgeGatewayAdminClient,
  KnowledgeGatewayClient,
  clientConfig as knowledgeConfig,
  provisionerConfig as knowledgeProvisioner,
} from "@hutian-ai/knowledge-gateway-client";
import {
  MemoryGatewayAdminClient,
  MemoryGatewayClient,
  clientConfig as memoryConfig,
  provisionerConfig as memoryProvisioner,
} from "@hutian-ai/memory-gateway-client";

/** Host extension contract. Domain request/response schemas are owned by each independent module. */
export interface ResourcePlugin<Client, Config> {
  readonly id: string;
  readonly kind: "memory" | "knowledge";
  readonly version: 1;
  parseConfig(value: unknown): Config;
  connect(config: Config, resourceId: string): Client;
  provision(config: unknown, resourceId: string): Promise<Config>;
  check(client: Client): Promise<unknown>;
}

export const memoryPlugin = {
  id: "memory-gateway",
  kind: "memory",
  version: 1,
  parseConfig: (value: unknown) => memoryConfig.parse(value),
  connect: (config, id) => new MemoryGatewayClient(config, id),
  provision: (config, id) =>
    new MemoryGatewayAdminClient(memoryProvisioner.parse(config)).provision(id),
  check: (client) => client.capabilities(),
} satisfies ResourcePlugin<
  MemoryGatewayClient,
  ReturnType<typeof memoryConfig.parse>
>;

export const knowledgePlugin = {
  id: "knowledge-gateway",
  kind: "knowledge",
  version: 1,
  parseConfig: (value: unknown) => knowledgeConfig.parse(value),
  connect: (config, id) => new KnowledgeGatewayClient(config, id),
  provision: (config, id) =>
    new KnowledgeGatewayAdminClient(
      knowledgeProvisioner.parse(config),
    ).provision(id),
  check: (client) => client.capabilities(),
} satisfies ResourcePlugin<
  KnowledgeGatewayClient,
  ReturnType<typeof knowledgeConfig.parse>
>;

/** Built-in, reviewed server plugins. Registration never accepts executable code from the browser. */
export const resourcePlugins = Object.freeze({
  memory: memoryPlugin,
  knowledge: knowledgePlugin,
});
