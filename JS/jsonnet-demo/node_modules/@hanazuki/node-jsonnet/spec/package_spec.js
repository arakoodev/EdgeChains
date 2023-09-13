const fs = require('fs').promises;
const path = require('path');

describe('package', () => {

  const licenseFiles = [
    'LICENSE',
    'third_party/jsonnet/LICENSE',
    'third_party/jsonnet/third_party/json/LICENSE',
    'third_party/jsonnet/third_party/md5/LICENSE',
    'third_party/jsonnet/third_party/rapidyaml/rapidyaml/LICENSE.txt',
    'third_party/jsonnet/third_party/rapidyaml/rapidyaml/ext/c4core/LICENSE.txt',
    'third_party/jsonnet/third_party/rapidyaml/rapidyaml/ext/c4core/src/c4/ext/fast_float/LICENSE',
  ];

  for(const licenseFile of licenseFiles) {
    it(`contains ${licenseFile}`, async () => {
      return expectAsync(fs.stat(path.join(__dirname, '..', licenseFile))).toBeResolved();
    });
  }

});
