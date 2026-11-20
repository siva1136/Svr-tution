// Bundles the functions (plus the workspace packages @svr/shared and
// @svr/node-api) into lib/index.js so `firebase deploy` only needs the
// npm dependencies listed in package.json.
import { build } from 'esbuild';

await build({
  entryPoints: ['src/index.ts'],
  outfile: 'lib/index.js',
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  sourcemap: true,
  external: ['firebase-admin', 'firebase-functions', 'express'],
  logLevel: 'info',
});
