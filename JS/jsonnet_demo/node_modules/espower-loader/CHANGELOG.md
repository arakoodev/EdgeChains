## 0.8.0 (2014-08-12)


#### Features

* **espower-loader:** update espower-source to 0.8.0 ([54c2143b](https://github.com/twada/espower-loader/commit/54c2143bba3966aaf61f1a4d331f3543257f9222))


#### Breaking Changes

If you already customize instrumentation pattern using `powerAssertVariableName` and `targetMethods`, you need to migarte. To migrate, change your code from the following:

```javascript
require('espower-loader')({
    cwd: process.cwd(),
    pattern: 'test/**/*.js',
    espowerOptions: {
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
    }
});
```

To:

```javascript
require('espower-loader')({
    cwd: process.cwd(),
    pattern: 'test/**/*.js',
    espowerOptions: {
        patterns: [
            'yourAssert(value, [message])',
            'yourAssert.okay(value, [message])',
            'yourAssert.equal(actual, expected, [message])',
            'yourAssert.customEqual(actual, expected, [message])'
        ]
    }
});
```
