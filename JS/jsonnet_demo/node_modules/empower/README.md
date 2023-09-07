empower
================================

[![Build Status](https://travis-ci.org/twada/empower.svg?branch=master)](https://travis-ci.org/twada/empower)
[![NPM version](https://badge.fury.io/js/empower.svg)](http://badge.fury.io/js/empower)
[![Dependency Status](https://gemnasium.com/twada/empower.svg)](https://gemnasium.com/twada/empower)
[![Coverage Status](https://coveralls.io/repos/twada/empower/badge.png?branch=master)](https://coveralls.io/r/twada/empower?branch=master)
[![License](http://img.shields.io/badge/license-MIT-brightgreen.svg)](https://github.com/twada/empower/blob/master/MIT-LICENSE.txt)
[![Built with Gulp](http://img.shields.io/badge/built_with-gulp-brightgreen.svg)](http://gulpjs.com/)


Power Assert feature enhancer for assert function/object.


DESCRIPTION
---------------------------------------
`empower` is a core module of [power-assert](http://github.com/twada/power-assert) family. `empower` enhances standard `assert` function or any assert-like object to work with power-assert feature added code instrumented by [espower](http://github.com/twada/espower).


`empower` works with standard `assert` function (best fit with [Mocha](http://visionmedia.github.io/mocha/)), and also supports assert-like objects/functions provided by various testing frameworks such as [QUnit](http://qunitjs.com/), [buster.js](http://docs.busterjs.org/en/latest/), and [nodeunit](https://github.com/caolan/nodeunit).


Please note that `empower` is a beta version product. Pull-requests, issue reports and patches are always welcomed. See [power-assert](http://github.com/twada/power-assert) project for more documentation.


CHANGELOG
---------------------------------------
See [CHANGELOG](https://github.com/twada/empower/blob/master/CHANGELOG.md)


API
---------------------------------------

### var enhancedAssert = espower(originalAssert, formatter, [options])

| return type            |
|:-----------------------|
| `function` or `object` |

`empower` function takes function or object(`originalAssert`) and `formatter` function created by [power-assert-formatter](http://github.com/twada/power-assert-formatter) then returns PowerAssert feature added function/object base on `originalAssert`.
If `destructive` option is falsy, `originalAssert` will be unchanged. If `destructive` option is truthy, `originalAssert` will be manipulated directly and returned `enhancedAssert` will be the same instance of `originalAssert`.


#### originalAssert

| type                   | default value |
|:-----------------------|:--------------|
| `function` or `object` | N/A           |

`originalAssert` is an instance of standard `assert` function or any assert-like object. see [SUPPORTED ASSERTION LIBRARIES](https://github.com/twada/empower#supported-assertion-libraries) and [ASSERTION LIBRARIES KNOWN TO WORK](https://github.com/twada/empower#assertion-libraries-known-to-work) section. Be careful that `originalAssert` will be manipulated directly if `destructive` option is truthy.


#### formatter

| type       | default value |
|:-----------|:--------------|
| `function` | N/A           |

formatter function created by [power-assert-formatter](http://github.com/twada/power-assert-formatter).


#### options

| type     | default value |
|:---------|:--------------|
| `object` | (return value of `empower.defaultOptions()`) |

Configuration options. If not passed, default options will be used.


#### options.destructive

| type      | default value |
|:----------|:--------------|
| `boolean` | `false`       |

If truthy, modify `originalAssert` destructively.

If `false`, espower mimics originalAssert as new object/function, so `originalAssert` will not be changed. If `true`, `originalAssert` will be manipulated directly and returned `enhancedAssert` will be the same instance of `originalAssert`.


#### options.modifyMessageOnRethrow

| type      | default value |
|:----------|:--------------|
| `boolean` | `false`       |

If truthy, modify `message` property of AssertionError on rethrow.


#### options.saveContextOnRethrow

| type      | default value |
|:----------|:--------------|
| `boolean` | `false`       |

If truthy, add `powerAssertContext` property to AssertionError on rethrow.


`modifyMessageOnRethrow` option and `saveContextOnRethrow` option makes behavior matrix as below.

| modifyMessageOnRethrow | saveContextOnRethrow | resulting behavior                                |
|:-----------------------|:---------------------|:--------------------------------------------------|
| `false` (default)      | `false` (default)    | Always modify assertion message argument directly |
| `true`                 | `false`              | Modify `message` of AssertionError on fail        |
| `false`                | `true`               | Do not modify `message` of AssertionError but add `powerAssertContext` property on fail |
| `true`                 | `true`               | On fail, modify `message` of AssertionError and also add `powerAssertContext` property |


#### options.patterns

| type                | default value       |
|:--------------------|:--------------------|
| `Array` of `string` | objects shown below |

```javascript
[
    'assert(value, [message])',
    'assert.ok(value, [message])',
    'assert.equal(actual, expected, [message])',
    'assert.notEqual(actual, expected, [message])',
    'assert.strictEqual(actual, expected, [message])',
    'assert.notStrictEqual(actual, expected, [message])',
    'assert.deepEqual(actual, expected, [message])',
    'assert.notDeepEqual(actual, expected, [message])'
]
```

Target patterns for power assert feature instrumentation.

Pattern detection is done by [escallmatch](http://github.com/twada/escallmatch). Any arguments enclosed in bracket (for example, `[message]`) means optional parameters. Without bracket means mandatory parameters.


### var options = empower.defaultOptions();

Returns default options object for `empower` function. In other words, returns

```javascript
{
    destructive: false,
    modifyMessageOnRethrow: false,
    saveContextOnRethrow: false,
    patterns: [
        'assert(value, [message])',
        'assert.ok(value, [message])',
        'assert.equal(actual, expected, [message])',
        'assert.notEqual(actual, expected, [message])',
        'assert.strictEqual(actual, expected, [message])',
        'assert.notStrictEqual(actual, expected, [message])',
        'assert.deepEqual(actual, expected, [message])',
        'assert.notDeepEqual(actual, expected, [message])'
    ]
}
```


SUPPORTED ASSERTION LIBRARIES
---------------------------------------
* [Node assert API](http://nodejs.org/api/assert.html)
* [Jxck/assert](https://github.com/Jxck/assert)


ASSERTION LIBRARIES KNOWN TO WORK
---------------------------------------
* [QUnit.assert](http://qunitjs.com/)
* [nodeunit](https://github.com/caolan/nodeunit)
* [buster-assertions](http://docs.busterjs.org/en/latest/modules/buster-assertions/)


INSTALL
---------------------------------------

### via npm

Install

    $ npm install --save-dev empower


### via bower

Install

    $ bower install --save-dev empower

Then load (`empower` function is exported)

    <script type="text/javascript" src="./path/to/bower_components/empower/build/empower.js"></script>


AUTHOR
---------------------------------------
* [Takuto Wada](http://github.com/twada)


LICENSE
---------------------------------------
Licensed under the [MIT](https://github.com/twada/empower/blob/master/MIT-LICENSE.txt) license.
