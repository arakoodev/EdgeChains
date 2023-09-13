const fs = require('fs');
const path = require('path');
const quoteRegExp = str => str.replace(/[.*+\-?^${}()|[\]\\]/g, '\\$&');

const {Jsonnet} = require("../");

const suiteDir = path.join(__dirname, '../third_party/jsonnet/test_suite');

describe('libjsonnet', () => {
  beforeEach(() => {
    process.chdir(suiteDir);

    jasmine.DEFAULT_TIMEOUT_INTERVAL = 60 * 1000;
  });

  const stackTraceLike = expected => ({
    asymmetricMatch: actual => {
      const stripped = actual
            .replace(/\tstd\.jsonnet:[0-9]*:[0-9-]*/g, "\tstd.jsonnet:<stdlib_position_redacted>");

      return stripped === expected
    },
    jasmineToString: () => expected
  });

  for (const dirent of fs.readdirSync(suiteDir, {withFileTypes: true})) {
    const fname = path.basename(dirent.name);
    if(!dirent.isFile() || !/\.jsonnet$/.test(fname)) continue;

    it(`process ${fname}`, async () => {

      if(/^trace\./.test(fname)) {
        pending('TODO: Test tracing');
      }

      const expectsError = /^error\./.test(fname);

      const jsonnet = new Jsonnet();
      if(/^tla\./.test(dirent.name)) {
        jsonnet.tlaString('var1', 'test').tlaCode('var2', `{x: 1, y: 2}`);
      } else {
        jsonnet.extString('var1', 'test').extCode('var2', `{x: 1, y: 2}`);
      }

      const golden = await fs.promises.readFile(`${fname}.golden`, {encoding: 'utf8'}).catch(() => "true\n");

      const result = jsonnet.evaluateFile(fname)

      if(expectsError) {
        try {
          await result;
          fail('Expected to rejected.');
        } catch(error) {
          expect(error.message).toEqual(stackTraceLike(golden));
        }
      } else {
        await expectAsync(result).toBeResolvedTo(golden);
      }
    });
  }
});
