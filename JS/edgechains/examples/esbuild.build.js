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
  entryPoints: ['./src/index.tsx'],
  bundle: true,
  platform: 'node',
  outfile: './dist/bundle.js',
  tsconfig: './tsconfig.json',
},)
  .catch(() => process.exit(1));
