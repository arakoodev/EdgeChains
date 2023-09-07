var assert = require('power-assert'),
    truthy = 'true',
    falsy = 'false';
assert(falsy);
assert.equal(truthy, falsy);
