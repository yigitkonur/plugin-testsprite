import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { detect } from '../lib/detect.mjs';

delete process.env.TESTSPRITE_PROJECT_ID; // would add a warning and break goldens

const here = path.dirname(fileURLToPath(import.meta.url));
const repos = path.join(here, 'fixtures', 'repos');
const goldens = path.join(here, 'fixtures', 'golden');

// Layer (a): hand-written from the doc 04 verdict table. units: path -> expected unit.
const EXPECT = {
  'web-vite': { '.': { kinds: ['web-frontend'], verdict: 'full' } },
  'web-next-ssr': { '.': { kinds: ['web-frontend'], verdict: 'full' } },
  'docs-docusaurus': { '.': { kinds: ['web-frontend'], verdict: 'full' } },
  'api-fastapi-openapi': { '.': { kinds: ['http-api'], verdict: 'full' } },
  'api-express-no-spec': { '.': { kinds: ['http-api'], verdict: 'full' } },
  'api-go-chi': { '.': { kinds: ['http-api'], verdict: 'full' } },
  'graphql-apollo': { '.': { kinds: ['graphql'], verdict: 'partial' } },
  'mcp-ts-stdio': { '.': { kinds: ['mcp-server'], transport: 'stdio', verdict: 'none' } },
  'mcp-ts-http': { '.': { kinds: ['mcp-server'], transport: 'http', verdict: 'partial' } },
  'mcp-py-fastmcp-stdio': { '.': { kinds: ['mcp-server'], transport: 'stdio', verdict: 'none' } },
  'mcp-py-http': { '.': { kinds: ['mcp-server'], transport: 'http', verdict: 'partial' } },
  'cli-node-bin': { '.': { kinds: ['cli-tool'], verdict: 'none' } },
  'cli-go-cobra': { '.': { kinds: ['cli-tool'], verdict: 'none' } },
  'cli-rust-clap': { '.': { kinds: ['cli-tool'], verdict: 'none' } },
  'lib-ts': { '.': { kinds: ['library'], verdict: 'none' } },
  'monorepo-pnpm-web-api': {
    'apps/web': { kinds: ['web-frontend'], verdict: 'full' },
    'services/api': { kinds: ['http-api'], verdict: 'full' },
  },
  'mcp-plus-landing-site': {
    '.': { kinds: ['web-frontend', 'mcp-server'], transport: 'stdio', verdict: 'mixed', perKind: { 'web-frontend': 'full', 'mcp-server': 'none' } },
  },
};

for (const [name, units] of Object.entries(EXPECT)) {
  test(`verdicts: ${name}`, () => {
    const result = detect(path.join(repos, name));
    assert.deepEqual(result.units.map((u) => u.path), Object.keys(units));
    for (const u of result.units) {
      const want = units[u.path];
      assert.deepEqual(u.kinds, want.kinds);
      assert.equal(u.transport, want.transport);
      assert.equal(u.fit.verdict, want.verdict);
      assert.deepEqual(u.fit.perKind, want.perKind);
    }
  });
}

test('monorepo: units are marked and nearest-ancestor TestSprite config is reported', () => {
  const { units } = detect(path.join(repos, 'monorepo-pnpm-web-api'));
  assert.ok(units.every((u) => u.monorepo));
  assert.deepEqual(units[0].testsprite, { configPath: 'apps/web/.testsprite/config.json', projectId: 'proj_8f0f6' });
  assert.equal(units[1].testsprite, null);
});

test('a lone .mcp.json (client config) is not an mcp-server', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'detect-mcpjson-'));
  fs.writeFileSync(path.join(dir, '.mcp.json'), JSON.stringify({ mcpServers: { demo: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-everything'] } } }));
  const result = detect(dir);
  assert.deepEqual(result.units, []);
});

// Layer (b): golden snapshots, root replaced by "<root>". UPDATE_GOLDEN=1 rewrites them.
for (const name of Object.keys(EXPECT)) {
  test(`golden: ${name}`, () => {
    const actual = { ...detect(path.join(repos, name)), root: '<root>' };
    const file = path.join(goldens, `${name}.json`);
    if (process.env.UPDATE_GOLDEN) {
      fs.mkdirSync(goldens, { recursive: true });
      fs.writeFileSync(file, `${JSON.stringify(actual, null, 2)}\n`);
    }
    assert.deepEqual(actual, JSON.parse(fs.readFileSync(file, 'utf8')));
  });
}
