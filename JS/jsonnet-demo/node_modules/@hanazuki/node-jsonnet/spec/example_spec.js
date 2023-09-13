const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const { promisify } = require('util');

const glob = require('glob').globSync;
const execFile = promisify(cp.execFile);

const jsExamples = path.join(__dirname, "../examples/*.{mjs,cjs}");
const tsExamples = path.join(__dirname, "../examples/*.ts");

const timeout = 10000;

const nodeMajor = Number.parseInt(process.versions.node.split('.')[0]);
if(nodeMajor >= 12) {

  describe('JavaScript examples', () => {
    for(const file of glob(jsExamples)) {
      it(`${file}`, async () => {
        await execFile('node', [file], {
          cwd: path.join(__dirname, '..'),
          timeout,
        });
      });
    }
  });

  describe('TypeScript examples', () => {
    for(const file of glob(tsExamples)) {
      it(`${file}`, async () => {
        await execFile('ts-node', [file], {
          cwd: path.join(__dirname, '../examples'),
          timeout,
        });
      });
    }
  });

}
