const esbuild = require('esbuild');
const path = require('path');
const fs = require('fs');

const outputDir = path.resolve(__dirname, 'dist');

// Create the 'dist' folder if it doesn't exist
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir);
}

const dist_path = path.join(process.cwd(), "dist");

fs.promises.mkdir(dist_path, { recursive: true });

esbuild.build({
  entryPoints: ['./src/index.ts'],
  bundle: true,
  platform: 'node',
  outdir: './dist',
  tsconfig: './tsconfig.json',
  sourcemap: true,
  target: 'node21.1.0',
  external: ['express', 'tsx', 'typescipt', 'typeorm', 'react', 'react-dom', 'pg', 'jsdom', 'hono', '@hanazuki/node-jsonnet'],
  format: 'cjs',
  loader: {
    '.html': 'text',
    '.css': 'css',
  },
},)
  .catch(() => process.exit(1));
