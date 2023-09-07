## 0.8.0 (2014-08-12)


#### Features

* **espower-source:**
  * update espower to 0.8.0 ([ae15a229](https://github.com/twada/espower-source/commit/ae15a229367c65a7a590104f3fb0fc0b2a7582d0))
  * simple xtend would be better for options handling ([6bea0a92](https://github.com/twada/espower-source/commit/6bea0a9241aba71f2dcae9c285561e68d91531bb))


#### Breaking Changes

  * update espower to 0.8.0 ([ae15a229](https://github.com/twada/espower-source/commit/ae15a229367c65a7a590104f3fb0fc0b2a7582d0))

If you already customize instrumentation pattern using `powerAssertVariableName` and `targetMethods`, you need to migarte. To migrate, change your code from the following:

```javascript
var espowerSource = require('espower-source'),
var options = {
    powerAssertVariableName: 'yourAssert',
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
var modifiedCode = espowerSource(originalCode, filepath, options));
```

To:

```javascript
var espowerSource = require('espower-source'),
var options = {
    patterns: [
        'yourAssert(value, [message])',
        'yourAssert.okay(value, [message])',
        'yourAssert.equal(actual, expected, [message])',
        'yourAssert.customEqual(actual, expected, [message])'
    ]
};
var modifiedCode = espowerSource(originalCode, filepath, options));
```
