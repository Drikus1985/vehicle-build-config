/**
 * Builds a fully self-contained, single-file demo of the app:
 *
 *   npm run build:demo      →  dist-demo/workbench-demo.html
 *
 * Everything is inlined — app JS/CSS plus the rights-safe assets (the CC0
 * TF-100 GLB, the CC0 Nova add-on GLB and the Apache-2.0 Draco decoder) as
 * base64 behind a fetch shim. The licensed Nova GLBs are deliberately NOT
 * embedded (their Standard License forbids public redistribution); requests
 * for them get a 404 so the app shows its truthful missing-asset state.
 *
 * The output has no <html>/<head>/<body> wrapper so it can be published as a
 * claude.ai artifact (which supplies the document skeleton); it also works
 * served as-is since browsers synthesise the skeleton.
 */
import { execSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);
const outDir = resolve(root, 'dist-demo');

console.log('Building single-file bundle…');
execSync('npx vite build --outDir dist-demo', {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, DEMO_SINGLE_FILE: '1' },
});

const assetsDir = resolve(outDir, 'assets');
const files = readdirSync(assetsDir);
const jsFile = files.find((f) => f.endsWith('.js'));
const cssFile = files.find((f) => f.endsWith('.css'));
if (!jsFile || !cssFile) throw new Error('expected one js and one css bundle in dist-demo/assets');

// `</script>` inside JS strings would terminate the inline tag early.
const js = readFileSync(resolve(assetsDir, jsFile), 'utf8').replaceAll('</script', '<\\/script');
const css = readFileSync(resolve(assetsDir, cssFile), 'utf8');

// Rights-safe embedded assets, served by the fetch shim (matched by suffix).
const EMBED = [
  'assets/vehicles/tf100-stepside.glb',
  'assets/vehicles/nova-addons.glb',
  'draco/draco_decoder.wasm',
  'draco/draco_wasm_wrapper.js',
  'draco/draco_decoder.js',
];
const embedded = Object.fromEntries(
  EMBED.map((path) => [path, readFileSync(resolve(root, 'public', path)).toString('base64')]),
);

// Licensed assets: absent by design → truthful missing-asset UI.
const BLOCKED = ['assets/vehicles/nova-1970.glb', 'assets/vehicles/nova-1970-uv.glb'];

const shim = `
// Fetch shim: serve the embedded rights-safe assets; 404 the licensed ones.
(() => {
  const embedded = ${JSON.stringify(embedded)};
  const blocked = ${JSON.stringify(BLOCKED)};
  const decode = (b64) => {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  };
  const types = { glb: 'model/gltf-binary', wasm: 'application/wasm', js: 'text/javascript' };
  const original = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const url = typeof input === 'string' ? input : input.url;
    const path = url.split('?')[0];
    for (const key of Object.keys(embedded)) {
      if (path.endsWith(key)) {
        const ext = key.split('.').pop();
        return Promise.resolve(
          new Response(decode(embedded[key]), {
            status: 200,
            headers: { 'Content-Type': types[ext] ?? 'application/octet-stream' },
          }),
        );
      }
    }
    for (const key of blocked) {
      if (path.endsWith(key)) return Promise.resolve(new Response(null, { status: 404 }));
    }
    return original(input, init);
  };
})();
`;

const html = `<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Workbench 48–78</title>
<style>${css}</style>
<style>html,body{height:100%;margin:0;background:#191b1f}#root{height:100%}</style>
<div id="root"></div>
<script>${shim}</script>
<script type="module">${js}</script>
`;

mkdirSync(outDir, { recursive: true });
const outFile = resolve(outDir, 'workbench-demo.html');
writeFileSync(outFile, html);
console.log(`${outFile}: ${(html.length / 1024 / 1024).toFixed(1)} MB single file`);
