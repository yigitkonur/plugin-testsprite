// sprite-detect: language-agnostic scan of a repo for project kinds and TestSprite fit (docs/design/04).
// Zero dependencies. Never executes anything, never follows symlinks, never reads files over 512 KB.
import fs from 'node:fs';
import path from 'node:path';

const ALWAYS_SKIP = new Set(['node_modules', '.git', 'vendor', 'dist', 'build', 'target', '.next', '__pycache__', '.venv']);
const MAX_BYTES = 512 * 1024;
const MANIFEST = /^(package\.json|pyproject\.toml|setup\.py|requirements(-.+)?\.txt|go\.mod|Cargo\.toml|pom\.xml|build\.gradle(\.kts)?|Gemfile|composer\.json|mix\.exs|.+\.csproj)$/;
const LANGS = { '.ts': 'typescript', '.tsx': 'typescript', '.js': 'javascript', '.jsx': 'javascript', '.mjs': 'javascript', '.cjs': 'javascript', '.py': 'python', '.go': 'go', '.rs': 'rust', '.java': 'java', '.kt': 'kotlin', '.rb': 'ruby', '.php': 'php', '.cs': 'csharp', '.ex': 'elixir', '.exs': 'elixir' };

// Dependency names (tokens of any manifest) per signal family.
const WEB_DEPS = /^(react|react-dom|preact|vue|svelte|solid-js|@angular\/core|next|nuxt|astro|@sveltejs\/kit|@remix-run\/react|@docusaurus\/core|react-scripts)$/;
const HTTP_DEPS = /^(express|fastify|koa|hono|@nestjs\/.+|fastapi|flask|django|starlette|aiohttp|github\.com\/(gin-gonic\/gin|labstack\/echo|go-chi\/chi|gofiber\/fiber)(\/.*)?|axum|actix-web|rocket|spring-boot.*|ktor.*|quarkus.*|micronaut.*|rails|sinatra|laravel\/.+|symfony\/.+|slim\/slim|microsoft\.aspnetcore.*|phoenix)$/;
const GQL_DEPS = /^(apollo-server.*|@apollo\/server|graphql-yoga|@graphql-yoga\/.+|mercurius|strawberry-graphql|graphene.*|github\.com\/99designs\/gqlgen.*|async-graphql.*|juniper)$/;
const MCP_DEPS = /^(@modelcontextprotocol\/.+|fastmcp|mcp|github\.com\/(mark3labs\/mcp-go|modelcontextprotocol\/.+)|rmcp|io\.modelcontextprotocol.*|modelcontextprotocol.*)$/;
const CLI_DEPS = /^(clap|click|typer|commander|yargs|oclif|@oclif\/core|github\.com\/(spf13\/cobra|urfave\/cli)(\/.*)?)$/;

const WEB_FILE = /^((vite|next|nuxt|svelte|astro|remix|docusaurus)\.config\.\w+|angular\.json|mkdocs\.yml|hugo\.toml|book\.toml|_config\.yml)$/;
const API_FILE = /^((openapi|swagger)\.(json|ya?ml)|.+\.postman_collection\.json)$/;
const DEPLOY_FILE = /^(vercel\.json|netlify\.toml|fly\.toml|render\.yaml|railway\.json|wrangler\.(toml|jsonc?)|serverless\.yml|app\.yaml|Procfile|Dockerfile)$/;

// Source markers: [regex, role]. The matched text becomes the evidence string.
const MARKERS = [
  [/StdioServerTransport/, 'stdio'], [/stdio_server\(/, 'stdio'], [/transport\s*=\s*["']stdio["']/, 'stdio'],
  [/ServeStdio/, 'stdio'], [/transport::stdio/, 'stdio'],
  [/StreamableHTTPServerTransport/, 'http'], [/SSEServerTransport/, 'http'],
  [/transport\s*=\s*["'](streamable-http|http|sse)["']/, 'http'], [/run_streamable_http|streamable_http_app|sse_app\(/, 'http'],
  [/NewStreamableHTTPServer|NewSSEServer/, 'http'], [/["'`]\/(mcp|sse)["'`]/, 'http'],
  [/["'`]\/graphql["'`]/, 'gqlRoute'],
  [/\bListenAndServe(TLS)?\(/, 'goHttp'],
  [/^\s*(import|from)\s+argparse\b/m, 'cli'],
];

const PORTS = [ // [name regex, default port, label]
  [/^(next|next\.config\.\w+)$/, 3000, 'next default'],
  [/^(nuxt|nuxt\.config\.\w+)$/, 3000, 'nuxt default'],
  [/^(astro|astro\.config\.\w+)$/, 4321, 'astro default'],
  [/^(@angular\/core|angular\.json)$/, 4200, 'angular default'],
  [/^react-scripts$/, 3000, 'CRA default'],
  [/^(@docusaurus\/core|docusaurus\.config\.\w+)$/, 3000, 'docusaurus default'],
  [/^(vite|vite\.config\.\w+|@sveltejs\/kit|svelte\.config\.\w+)$/, 5173, 'vite default'],
];

const NEEDS = {
  'web-frontend': 'reachable URL, or a dev/preview server port (--local needs a V3 account)',
  'http-api': 'public base URL (deployed preview or staging)',
  graphql: 'public GraphQL endpoint',
  'mcp-server': 'public MCP endpoint and auth token',
};

function kindFit(kind, transport) {
  if (kind === 'web-frontend' || kind === 'http-api') return { verdict: 'full' };
  if (kind === 'graphql') return { verdict: 'partial', why: 'proposal generation is best-effort; hand-author POST tests' };
  if (kind === 'mcp-server') {
    if (transport === 'http') return { verdict: 'partial', why: 'hand-author JSON-RPC tests against the public endpoint' };
    if (transport === 'unknown') return { verdict: 'partial', why: 'transport unknown; only testable if served over HTTP' };
    return { verdict: 'none', why: 'stdio transport only, no network surface for the cloud to call; use native client tests or an MCP inspector' };
  }
  if (kind === 'cli-tool') return { verdict: 'none', why: 'TestSprite cannot execute a binary; use native subprocess/golden tests' };
  return { verdict: 'none', why: 'no network surface; test a demo/docs site if there is one' }; // library
}

function fitOf(kinds, transport) {
  const per = Object.fromEntries(kinds.map((k) => [k, kindFit(k, transport)]));
  const testable = kinds.filter((k) => per[k].verdict !== 'none');
  const notes = kinds.filter((k) => per[k].verdict !== 'full').map((k) => `${k}: ${per[k].why}`);
  const needs = testable.map((k) => NEEDS[k]);
  if (kinds.length === 1) {
    const verdict = per[kinds[0]].verdict;
    return { verdict, needs, next: { full: 'init', partial: 'ask', none: 'stop' }[verdict], notes };
  }
  const perKind = Object.fromEntries(kinds.map((k) => [k, per[k].verdict]));
  return { verdict: 'mixed', needs, next: testable.length ? 'ask' : 'stop', perKind, notes };
}

const readText = (abs) => {
  try {
    return fs.statSync(abs).size > MAX_BYTES ? null : fs.readFileSync(abs, 'utf8');
  } catch {
    return null;
  }
};
const readJson = (abs) => {
  try {
    return JSON.parse(readText(abs));
  } catch {
    return null;
  }
};
const base = (p) => p.slice(p.lastIndexOf('/') + 1);
const dirOf = (p) => (p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '.');

// Simple .gitignore: names, globs, leading/trailing slash. Negations are ignored.
function loadIgnore(root) {
  const matchers = (readText(path.join(root, '.gitignore')) ?? '')
    .split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#') && !l.startsWith('!'))
    .map((line) => {
      const dirOnly = line.endsWith('/');
      const p = (dirOnly ? line.slice(0, -1) : line).replace(/^\//, '');
      const re = p.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*\/?/g, '\0').replace(/\*/g, '[^/]*').replace(/\?/g, '[^/]').replace(/\0/g, '(?:.*/)?');
      return { dirOnly, anchored: line.replace(/\/$/, '').includes('/'), re: new RegExp(`^${re}$`) };
    });
  return (rel, isDir) => matchers.some((m) => (isDir || !m.dirOnly) && m.re.test(m.anchored ? rel : base(rel)));
}

function walk(root, maxDepth, ignored) {
  const files = [];
  const visit = (rel, depth) => {
    const entries = fs.readdirSync(path.join(root, rel), { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1));
    for (const e of entries) {
      if (e.isSymbolicLink()) continue;
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) {
        if (depth < maxDepth && !ALWAYS_SKIP.has(e.name) && !ignored(r, true)) visit(r, depth + 1);
      } else if (e.isFile() && !ignored(r, false)) files.push(r);
    }
  };
  visit('', 0);
  return files;
}

function gitHead(root) {
  const head = readText(path.join(root, '.git', 'HEAD'))?.trim();
  if (!head) return null;
  if (!head.startsWith('ref: ')) return head;
  const ref = head.slice(5);
  const loose = readText(path.join(root, '.git', ref))?.trim();
  if (loose) return loose;
  const line = (readText(path.join(root, '.git', 'packed-refs')) ?? '').split('\n').find((l) => l.endsWith(` ${ref}`));
  return line ? line.split(' ')[0] : null;
}

function isMonorepo(root, files) {
  if (['pnpm-workspace.yaml', 'turbo.json', 'nx.json', 'lerna.json', 'go.work'].some((f) => files.includes(f))) return true;
  if (readJson(path.join(root, 'package.json'))?.workspaces) return true;
  return /^\[workspace\]/m.test(readText(path.join(root, 'Cargo.toml')) ?? '');
}

function testspriteLink(root, unit) {
  for (let dir = unit; ; dir = dirOf(dir)) {
    const rel = dir === '.' ? '.testsprite/config.json' : `${dir}/.testsprite/config.json`;
    const text = readText(path.join(root, rel));
    if (text !== null) {
      let projectId = null;
      try { projectId = JSON.parse(text).projectId ?? null; } catch { /* malformed config: linked, id unknown */ }
      return { configPath: rel, projectId };
    }
    if (dir === '.') return null;
  }
}

function analyze(root, unit, files, deployWorkflows, monorepo, warnings) {
  const rel = (f) => (unit === '.' ? f : f.slice(unit.length + 1));
  const rels = files.map(rel);
  const at = (name) => (rels.includes(name) ? readText(path.join(root, unit === '.' ? name : `${unit}/${name}`)) : null);
  const evidence = [];
  const add = (s) => { if (!evidence.includes(s)) evidence.push(s); };

  // Manifests -> dependency tokens + raw text for section checks ([project.scripts], [lib], ...).
  const pkg = readJson(path.join(root, unit === '.' ? 'package.json' : `${unit}/package.json`));
  const tokens = new Set(Object.keys({ ...pkg?.dependencies, ...pkg?.devDependencies, ...pkg?.optionalDependencies }));
  let manifestText = '';
  for (const r of rels.filter((r) => !r.includes('/') && MANIFEST.test(r) && r !== 'package.json')) {
    const text = at(r) ?? '';
    manifestText += `${text}\n`;
    for (const t of text.toLowerCase().split(/[\s"',[\](){}<>=!~;:]+/)) if (t) tokens.add(t);
  }
  const deps = (re) => [...tokens].filter((t) => re.test(t));

  // Source markers.
  const roles = { stdio: [], http: [], gqlRoute: [], goHttp: [], cli: [] };
  let goMain = false;
  for (const [i, r] of rels.entries()) {
    if (!LANGS[path.extname(r)]) continue;
    const text = readText(path.join(root, files[i]));
    if (text === null) continue;
    const found = MARKERS.map(([re, role]) => [role, text.match(re)?.[0].replace(/^["'`]|["'`]$/g, '')]);
    if (/FastMCP/.test(text) && /\.run\(\s*\)/.test(text)) found.push(['stdio', 'FastMCP.run()']); // FastMCP default transport
    for (const [role, name] of found) if (name && !roles[role].includes(name)) roles[role].push(name);
    if (r.endsWith('.go') && /^package main\b/m.test(text)) goMain = true;
  }

  // web-frontend
  const webDeps = deps(WEB_DEPS);
  const webFiles = rels.filter((r) => WEB_FILE.test(base(r)) || /^(public\/|src\/)?index\.html$/.test(r));
  const web = webDeps.length > 0 || webFiles.length > 0;

  // http-api: specs always count; framework signals only when no other kind explains the server.
  const apiFiles = rels.filter((r) => API_FILE.test(base(r)));
  const frameworks = deps(HTTP_DEPS);
  const strongHttp = frameworks.length > 0 || roles.goHttp.length > 0;
  const expose = at('Dockerfile')?.match(/^\s*EXPOSE\s+\d+/m)?.[0].trim().replace(/\s+/g, ' ');
  const envPort = at('.env.example')?.match(/^\s*PORT\s*=\s*\d+/m)?.[0].replace(/\s/g, '');
  const weakHttp = Boolean(expose || envPort);

  // graphql
  const gqlDeps = deps(GQL_DEPS);
  const gqlFiles = rels.filter((r) => /\.(graphql|graphqls)$/.test(r) && /\b(type|extend\s+type)\s+(Query|Mutation)\b/.test(readText(path.join(root, files[rels.indexOf(r)])) ?? ''));
  const graphql = gqlDeps.length > 0 || gqlFiles.length > 0 || (roles.gqlRoute.length > 0 && strongHttp);

  // mcp-server
  const mcpDeps = deps(MCP_DEPS);
  const mcpFiles = rels.filter((r) => base(r) === 'smithery.yaml' || (r === 'server.json' && /modelcontextprotocol/.test(at(r) ?? '')));
  const mcp = mcpDeps.length > 0 || mcpFiles.length > 0;

  const kinds = [];
  if (web) kinds.push('web-frontend');
  const absorbed = mcp || graphql;
  if (apiFiles.length || (!absorbed && (strongHttp || (weakHttp && !web)))) kinds.push('http-api');
  if (graphql) kinds.push('graphql');
  if (mcp) kinds.push('mcp-server');

  const label = unit === '.' ? 'repo root' : unit;
  let transport;
  if (mcp) {
    const hasHttpSurface = strongHttp || weakHttp;
    if (roles.http.length) {
      transport = 'http';
      if (roles.stdio.length) warnings.push(`${label}: both stdio and http MCP transport markers found; treating as http, confirm the HTTP transport is deployed`);
    } else if (roles.stdio.length) {
      transport = hasHttpSurface ? 'unknown' : 'stdio';
      if (hasHttpSurface) warnings.push(`${label}: stdio markers (${roles.stdio[0]}) and an HTTP server (${frameworks[0] ?? roles.goHttp[0] ?? expose ?? envPort}) found: confirm whether the HTTP server is the MCP transport`);
    } else {
      transport = hasHttpSurface ? 'http' : 'unknown';
      if (!hasHttpSurface) warnings.push(`${label}: MCP server found but no stdio or http transport marker: confirm how it is served`);
    }
  }

  // Only when nothing is served: cli-tool, then library.
  if (!kinds.length) {
    const scripts = /^\[(project|tool\.poetry)\.scripts\]/m.test(manifestText) || manifestText.includes('console_scripts');
    const strongCli = Boolean(pkg?.bin) || scripts;
    const weakCli = deps(CLI_DEPS).length > 0 || roles.cli.length > 0;
    const cargoLib = rels.includes('Cargo.toml') && (/^\[lib\]/m.test(manifestText) || rels.includes('src/lib.rs'));
    const pyLib = /^\[(project|tool\.poetry)\]/m.test(manifestText) || rels.includes('setup.py');
    const goLib = rels.includes('go.mod') && !goMain;
    const nodeLib = ['main', 'exports', 'types', 'module'].find((f) => pkg?.[f]);
    if (strongCli || weakCli) kinds.push('cli-tool');
    else if (nodeLib || cargoLib || pyLib || goLib) kinds.push('library');
    if (kinds[0] === 'cli-tool') {
      if (pkg?.bin) add('field:bin');
      if (scripts) add('field:scripts');
      if (/^\[\[bin\]\]/m.test(manifestText)) add('field:[[bin]]');
      for (const r of rels.filter((r) => /^cmd\/[^/]+\/main\.go$/.test(r))) add(`file:${r}`);
    } else if (kinds[0] === 'library') {
      if (nodeLib) add(`field:${nodeLib}`);
      else add(`file:${['Cargo.toml', 'go.mod', 'pyproject.toml', 'setup.py'].find((f) => rels.includes(f))}`);
    }
  }
  if (!kinds.length) return null;

  // Evidence for the serving kinds.
  for (const f of webFiles) add(`file:${f}`);
  for (const f of [...apiFiles, ...gqlFiles, ...mcpFiles]) add(`file:${f}`);
  for (const d of [...webDeps, ...(kinds.includes('http-api') || mcp || graphql ? frameworks : []), ...gqlDeps, ...mcpDeps, ...(kinds[0] === 'cli-tool' ? deps(CLI_DEPS) : [])]) add(`dep:${d}`);
  for (const m of [...roles.stdio, ...roles.http, ...(graphql ? roles.gqlRoute : []), ...roles.goHttp, ...(kinds[0] === 'cli-tool' ? roles.cli : [])]) add(`marker:${m}`);
  if (kinds.includes('http-api') || mcp) for (const e of [expose, envPort]) if (e) add(`marker:${e}`);
  const scripts = pkg?.scripts ?? {};
  if (web) for (const s of ['dev', 'start', 'preview']) if (scripts[s]) add(`script:${s}`);

  // Dev server: only for a web unit with a dev/start/preview script.
  let devServer;
  const script = ['dev', 'start', 'preview'].find((s) => scripts[s]);
  if (web && script) {
    const names = [...tokens, ...webFiles.map(base)];
    const flag = scripts[script].match(/(?:--port|-p)[ =](\d+)|\bPORT=(\d+)/);
    const config = webFiles.map((f) => (readText(path.join(root, unit === '.' ? f : `${unit}/${f}`)) ?? '').match(/\bport\s*:\s*(\d+)/)).find(Boolean);
    const dflt = PORTS.find(([re]) => names.some((n) => re.test(n)));
    const found = flag ? [+(flag[1] ?? flag[2]), `script flag (${script})`] : config ? [+config[1], 'config file'] : dflt ? [dflt[1], dflt[2]] : null;
    if (found) devServer = { cmd: script === 'start' ? 'npm start' : `npm run ${script}`, port: found[0], source: found[1] };
  }

  const deploy = rels.filter((r) => DEPLOY_FILE.test(r) && !r.includes('/')).concat(rels.some((r) => r.startsWith('.vercel/')) ? ['.vercel/'] : [], deployWorkflows);
  const languages = [...new Set(rels.map((r) => LANGS[path.extname(r)]).filter(Boolean))].sort();

  return {
    path: unit, languages, kinds, ...(transport && { transport }), ...(monorepo && { monorepo: true }), evidence,
    ...(devServer && { devServer }), deploy, testsprite: testspriteLink(root, unit), fit: fitOf(kinds, transport),
  };
}

export function detect(rootPath, opts = {}) {
  const root = fs.realpathSync(rootPath);
  const files = walk(root, opts.depth ?? 4, loadIgnore(root));
  const warnings = [];

  // Units: every directory holding a manifest, plus the root. A file belongs to its nearest unit.
  const dirs = new Set(['.', ...files.filter((f) => MANIFEST.test(base(f))).map(dirOf)]);
  const byDepth = [...dirs].sort((a, b) => b.length - a.length);
  const owned = new Map([...dirs].map((d) => [d, []]));
  for (const f of files) owned.get(byDepth.find((d) => d === '.' || f.startsWith(`${d}/`))).push(f);

  const workflowDir = path.join(root, '.github', 'workflows');
  const workflows = fs.existsSync(workflowDir) ? fs.readdirSync(workflowDir).filter((n) => /\.ya?ml$/.test(n)).sort() : [];
  const deployWorkflows = workflows.filter((n) => n !== 'testsprite.yml' && /deploy/i.test(readText(path.join(workflowDir, n)) ?? '')).map((n) => `.github/workflows/${n}`);
  const skillsDir = path.join(root, '.claude', 'skills');
  const skills = fs.existsSync(skillsDir) ? fs.readdirSync(skillsDir).filter((n) => n.startsWith('testsprite-')).sort() : [];
  if (skills.length) warnings.push('official testsprite skills present in .claude/skills (duplicate guidance)');
  if (process.env.TESTSPRITE_PROJECT_ID) warnings.push('TESTSPRITE_PROJECT_ID is set in the environment');

  const monorepo = isMonorepo(root, files);
  const units = [...dirs].sort().map((d) => analyze(root, d, owned.get(d), deployWorkflows, monorepo, warnings)).filter(Boolean);
  if (!units.length) warnings.push('no web, API, MCP, CLI or library signals found');

  return {
    root, git: { head: gitHead(root) },
    testsprite: { workflow: workflows.includes('testsprite.yml') ? '.github/workflows/testsprite.yml' : null, skills },
    units, warnings,
  };
}

export function render(r) {
  const out = [`sprite-detect: ${r.root}${r.git.head ? ` (git ${r.git.head.slice(0, 7)})` : ''}`];
  for (const u of r.units) {
    const per = u.fit.perKind ? ` (${Object.entries(u.fit.perKind).map(([k, v]) => `${k}: ${v}`).join(', ')})` : '';
    out.push('', `unit ${u.path}  [${u.languages.join(', ')}]${u.monorepo ? '  (monorepo)' : ''}`);
    out.push(`  kinds: ${u.kinds.join(', ')}${u.transport ? `  (mcp transport: ${u.transport})` : ''}`);
    out.push(`  TestSprite fit: ${u.fit.verdict}${per}  next: ${u.fit.next}`);
    for (const n of u.fit.needs) out.push(`  needs: ${n}`);
    for (const n of u.fit.notes) out.push(`  note: ${n}`);
    if (u.devServer) out.push(`  dev server: ${u.devServer.cmd} on :${u.devServer.port} (${u.devServer.source})`);
    out.push(`  evidence: ${u.evidence.join(', ')}`);
    if (u.deploy.length) out.push(`  deploy: ${u.deploy.join(', ')}`);
    out.push(`  testsprite: ${u.testsprite ? `${u.testsprite.projectId ?? 'no projectId'} (${u.testsprite.configPath})` : 'not linked'}`);
  }
  if (r.testsprite.workflow) out.push('', `CI: ${r.testsprite.workflow} present`);
  for (const w of r.warnings) out.push(`warning: ${w}`);
  return `${out.join('\n')}\n`;
}

// CLI entry used by bin/sprite-detect. Returns the exit code.
export function main(argv) {
  const args = argv.filter((a) => a !== '--json');
  if (args.length > 1 || args.some((a) => a.startsWith('-'))) {
    process.stderr.write('usage: sprite-detect [path] [--json]\n');
    return 2;
  }
  const target = path.resolve(args[0] ?? '.');
  if (!fs.existsSync(target) || !fs.statSync(target).isDirectory()) {
    process.stderr.write(`sprite-detect: not a directory: ${target}\n`);
    return 2;
  }
  const result = detect(target);
  process.stdout.write(argv.includes('--json') ? `${JSON.stringify(result, null, 2)}\n` : render(result));
  return 0;
}
