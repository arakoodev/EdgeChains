## 0.8.0 (2014-08-12)


#### Features


* **empower:**
  * [modularized by browserify](https://github.com/twada/empower/pull/12)
  * use `escallmatch` module to describe target patterns ([533a21a0](https://github.com/twada/empower/commit/533a21a0374f23f5ca4e198c17d1e20f10d705fa))
  * support assertion methods with three or more arguments ([d31dca86](https://github.com/twada/empower/commit/d31dca86de2b05ee88ca5df15579308368657d43))
  * if not in patterns, do not empower assertion function itself ([1d73a756](https://github.com/twada/empower/commit/1d73a7560ef586a45a0a9259e57c143b3b60caaa))
  * option `targetMethods` does not required any more ([8ffcc49f](https://github.com/twada/empower/commit/8ffcc49fcdb5523eb38e63a0e7cca34f752d9302))
  * rename `saveContextOnFail` option to `saveContextOnRethrow` ([1f6133b2](https://github.com/twada/empower/commit/1f6133b24be672f32cfd3b66522a7d14ca5d22e1))
  * rename `modifyMessageOnFail` option to `modifyMessageOnRethrow` ([0c8a88f0](https://github.com/twada/empower/commit/0c8a88f0592917ba15ac0c1bf21c8f39f39ab350))


#### Breaking Changes

* `saveContextOnFail` option is renamed to `saveContextOnRethrow`

There is nothing to change unless you are using `saveContextOnFail` option.

If you are using `saveContextOnFail` option, change your code from the following:

`empower(originalAssert, formatter, {saveContextOnFail: true})`

To:

`empower(originalAssert, formatter, {saveContextOnRethrow: true})`

 ([1f6133b2](https://github.com/twada/empower/commit/1f6133b24be672f32cfd3b66522a7d14ca5d22e1))

* `modifyMessageOnFail` option is renamed to `modifyMessageOnRethrow`

There is nothing to change unless you are using `modifyMessageOnFail` option.

If you are using `modifyMessageOnFail` option, change your code from the following:

`empower(originalAssert, formatter, {modifyMessageOnFail: true})`

To:

`empower(originalAssert, formatter, {modifyMessageOnRethrow: true})`

 ([0c8a88f0](https://github.com/twada/empower/commit/0c8a88f0592917ba15ac0c1bf21c8f39f39ab350))

* option `targetMethods` does not required any more

If you already customize enhancement pattern using `targetMethods`, you need to migarte. To migrate, change your code from the following:

```javascript
var yourAssert = require('./your-assert');
var empower = require('empower');
var formatter = require('power-assert-formatter')();
var options = {
    targetMethods: {
        oneArg: [
            'okay'
        ],
        twoArgs: [
            'equal',
            'customEqual'
        ]
    }
};
var assert = empower(yourAssert, formatter, options);
```

To:

```javascript
var yourAssert = require('./your-assert');
var empower = require('empower');
var formatter = require('power-assert-formatter')();
var options = {
    patterns: [
        'yourAssert(value, [message])',
        'yourAssert.okay(value, [message])',
        'yourAssert.equal(actual, expected, [message])',
        'yourAssert.customEqual(actual, expected, [message])'
    ]
};
var assert = empower(yourAssert, formatter, options);
```

([8ffcc49f](https://github.com/twada/empower/commit/8ffcc49fcdb5523eb38e63a0e7cca34f752d9302))
