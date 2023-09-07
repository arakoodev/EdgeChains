## 0.8.0 (2014-08-12)


#### Features


* **power-assert-formatter:**
  * [built and modularized by browserify](https://github.com/twada/power-assert-formatter/pull/8)
  * [use spun-off stringifier module](https://github.com/twada/power-assert-formatter/pull/9)


#### Breaking Changes

* option `stringifyDepth` does not supported any more. use `maxDepth` option instead.

If you already customize formatter config using `stringifyDepth`, you need to migarte. To migrate, change your code from the following:

```javascript
var createFormatter = require('power-assert-formatter');
var options = {
    stringifyDepth: 2
};
var formatter = createFormatter(options);
```

To:

```javascript
var createFormatter = require('power-assert-formatter');
var options = {
    maxDepth: 1
};
var formatter = createFormatter(options);
```

Beware that `stringifyDepth - 1 === maxDepth` !
