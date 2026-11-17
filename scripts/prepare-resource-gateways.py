"""Explicit local operator adoption. No document moves, re-indexing, or identity changes.

Prepare files first, start both gateways, then --activate before restarting the API.
This script is only for this adjacent-repository development deployment.
"""
from pathlib import Path
import argparse
import hashlib
import json
import os
import secrets
import shutil
import tempfile
from datetime import datetime, timezone

parser = argparse.ArgumentParser()
parser.add_argument('--activate', action='store_true')
args = parser.parse_args()
os.umask(0o077)
world = Path(__file__).resolve().parent.parent
root = world.parent
stage = world / '.local/resource-gateways'
stage.mkdir(parents=True, exist_ok=True)


def read(path):
    return json.loads(path.read_text())


def save(path, data):
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    with tempfile.NamedTemporaryFile('w', dir=path.parent, delete=False) as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write('\n')
        f.flush()
        os.fsync(f.fileno())
    Path(f.name).replace(path)


def credential(policy, resource, output, url):
    if output.exists():
        return
    raw = 'know_' + secrets.token_urlsafe(32)
    grants = {resource: ['read', 'write']}
    policy['credentials'][hashlib.sha256(raw.encode()).hexdigest()] = {
        'id': 'world-' + hashlib.sha256(resource.encode()).hexdigest()[:24],
        'grants': grants, 'disabled': False, 'expires_at': None}
    save(output, {'url': url, 'token': raw, 'grants': grants, 'protocol': 'v1'})


if args.activate:
    import urllib.request
    for port in (3332, 3333):
        with urllib.request.urlopen('http://127.0.0.1:' + str(port) + '/health', timeout=5) as r:
            assert r.status == 200
    for source in (stage / 'clients').rglob('*.json'):
        destination = world / '.local' / source.relative_to(stage / 'clients')
        if destination.exists() and not (stage / 'backups' / source.relative_to(stage / 'clients')).exists():
            backup = stage / 'backups' / source.relative_to(stage / 'clients')
            backup.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(destination, backup)
        save(destination, read(source))
    print('Gateway connections activated; original client configuration backed up. Restart API after building it.')
    raise SystemExit(0)

bindings = read(world / '.local/access-bindings.json')['bindings']
assert len(bindings) == 1, 'Select a single authorized workspace explicitly before adoption'
namespace = bindings[0]['resourceNamespace']
workspace_key = 'hw-' + hashlib.sha256(json.dumps([namespace, {'kind': 'workspace'}], separators=(',', ':'), ensure_ascii=False).encode()).hexdigest()[:40]
legacy = read(world / '.local/knowledge-client.json')
server = root / '.local/knowledge-gateway'
server.mkdir(parents=True, exist_ok=True)
policy_path = server / 'policy.json'
policy = read(policy_path) if policy_path.exists() else {'version': 1, 'resources': {}, 'credentials': {}}
resources = [(workspace_key, legacy['workspace'], Path(legacy['library']), stage / 'clients/knowledge-gateway-client.json')]
for library in (world / '.local/resource-libraries').glob('hw-*'):
    if library.is_dir():
        resources.append((library.name, library.name, library, stage / 'clients/knowledge-clients' / (library.name + '.json')))
manifest = []
for resource, native, library, output in resources:
    binding = {'namespace': native, 'connection_id': 'anythingllm', 'library': str(library), 'source_prefix': 'hutian://knowledge/'}
    old = policy['resources'].get(resource)
    assert old is None or all(old.get(k) == v for k, v in binding.items()), 'Existing resource binding differs'
    policy['resources'][resource] = {**(old or {}), **binding}
    credential(policy, resource, output, 'http://127.0.0.1:3333')
    for path in library.glob('*.json'):
        manifest.append({'resource': resource, 'path': str(path), 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()})
save(policy_path, policy)
save(server / 'connections.json', {'anythingllm': {'type': 'anythingllm', 'url': 'http://hutian-knowledge:3001', 'token': legacy['token']}})
if not (stage / 'original-documents.json').exists():
    save(stage / 'original-documents.json', {'prepared_at': datetime.now(timezone.utc).isoformat(), 'documents': manifest})

for kind, folder, url, connection in [('memory', root / '.local/memory/access', 'http://127.0.0.1:3332', 'hindsight'), ('knowledge', server, 'http://127.0.0.1:3333', 'anythingllm')]:
    config_path = folder / 'host-provisioning.json'
    client_path = stage / 'clients' / (kind + '-provisioner.json')
    if config_path.exists() or client_path.exists():
        assert config_path.exists() and client_path.exists(), 'Incomplete provisioner configuration; inspect before retry'
        continue
    raw = 'host_' + secrets.token_urlsafe(32)
    save(config_path, {'issuers': [{'id': 'hutian-world', 'token_sha256': hashlib.sha256(raw.encode()).hexdigest(),
        'secret': secrets.token_urlsafe(48), 'resource_pattern': '^hw-[a-f0-9]{40}$',
        'connection': connection, 'permissions': ['read', 'write'], 'write_mode': 'infer'}]})
    save(client_path, {'url': url, 'token': raw})
# Mount only existing knowledge libraries; ownership moves logically without moving any original files.
mounts = sorted(set(str(library) for _, _, library, _ in resources if library.exists()))
save(stage / 'mounts.json', mounts)

state = server / 'state'
state.mkdir(parents=True, exist_ok=True)
compose = {'name': 'hutian-knowledge-gateway', 'services': {'knowledge-gateway': {
    'image': 'hutian-knowledge-gateway:0.1.0', 'build': {'context': str(root / 'knowledge-gateway')},
    'container_name': 'hutian-knowledge-gateway', 'user': str(os.getuid()), 'restart': 'unless-stopped',
    'ports': ['127.0.0.1:3333:8080'],
    'environment': {'KNOWLEDGE_POLICY': '/run/knowledge/policy.json', 'KNOWLEDGE_CONNECTIONS_FILE': '/run/knowledge/connections.json',
        'KNOWLEDGE_ADMIN_CONFIG': '/run/knowledge/host-provisioning.json', 'KNOWLEDGE_STATE': '/run/knowledge/state',
        'KNOWLEDGE_PUBLIC_URL': 'http://127.0.0.1:3333', 'PYTHONDONTWRITEBYTECODE': '1'},
    'volumes': [str(server) + ':/run/knowledge', str(root / 'knowledge-gateway/knowledge_gateway') + ':/app/knowledge-gateway/knowledge_gateway:ro'] + [path + ':' + path for path in mounts],
    'healthcheck': {'test': ['CMD', 'python', '-c', "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8080/health',timeout=4)"], 'interval': '10s', 'timeout': '5s', 'retries': 6},
    'networks': ['hutian']}}, 'networks': {'hutian': {'external': True, 'name': 'hutian-local_default'}}}
save(server / 'compose.json', compose)

print('Prepared gateway policy, scoped clients, and private provisioners. Original documents:', len(manifest))
print('No active World connection changed. Start gateway services, then run this script with --activate.')
