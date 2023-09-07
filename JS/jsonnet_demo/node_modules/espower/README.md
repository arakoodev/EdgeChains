espower
================================

[![Build Status](https://travis-ci.org/twada/espower.svg?branch=master)](https://travis-ci.org/twada/espower)
[![NPM version](https://badge.fury.io/js/espower.svg)](http://badge.fury.io/js/espower)
[![Dependency Status](https://gemnasium.com/twada/espower.svg)](https://gemnasium.com/twada/espower)
[![Coverage Status](https://coveralls.io/repos/twada/espower/badge.png?branch=master)](https://coveralls.io/r/twada/espower?branch=master)
[![License](http://img.shields.io/badge/license-MIT-brightgreen.svg)](https://github.com/twada/espower/blob/master/MIT-LICENSE.txt)
[![Built with Gulp](http://img.shields.io/badge/built_with-gulp-brightgreen.svg)](http://gulpjs.com/)


Power Assert feature instrumentor based on the Mozilla JavaScript AST.


DESCRIPTION
---------------------------------------
`espower` is a core module of [power-assert](http://github.com/twada/power-assert) family. 


`espower` detects and manipulates assertion expression (JavaScript Code) in original AST represented as [Mozilla JavaScript AST](https://developer.mozilla.org/en-US/docs/SpiderMonkey/Parser_API), to instrument power-assert feature into returned new AST object. [Mozilla JavaScript AST](https://developer.mozilla.org/en-US/docs/SpiderMonkey/Parser_API) in, Mozilla JavaScript AST out.


Please note that `espower` is a beta version product. Pull-requests, issue reports and patches are always welcomed. See [power-assert](http://github.com/twada/power-assert) project for more documentation.


CHANGELOG
---------------------------------------
See [CHANGELOG](https://github.com/twada/espower/blob/master/CHANGELOG.md)


API
---------------------------------------

### var modifiedAst = espower(originalAst, [options])

| return type |
|:------------|
| `object`    |

`espower` function manipulates `originalAst` then returns `modifiedAst` that is also an AST node object defined in [Mozilla JavaScript AST spec](https://developer.mozilla.org/en-US/docs/SpiderMonkey/Parser_API).
If `destructive` option is falsy, `originalAst` will be unchanged. If `destructive` option is truthy, `originalAst` will be manipulated directly and returned `modifiedAst` will be the same instance of `originalAst`.


#### originalAst

| type     | default value |
|:---------|:--------------|
| `object` | N/A           |

`originalAst` should be an AST node object defined in [Mozilla JavaScript AST spec](https://developer.mozilla.org/en-US/docs/SpiderMonkey/Parser_API).


#### options

| type     | default value |
|:---------|:--------------|
| `object` | (return value of `espower.defaultOptions()`) |

Configuration options. If not passed, default options will be used.


#### options.destructive

| type      | default value |
|:----------|:--------------|
| `boolean` | `false`       |

Modify `originalAst` destructively or not.

If `false`, espower clones `originalAst` deeply, so `originalAst` will be unchanged. If `true`, `originalAst` will be manipulated directly and returned `modifiedAst` will be the same instance of `originalAst`.


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

If callee name (for example, `assert.equal`) matches exactly and number of arguments is satisfied, then the assertion will be modified.
Detection is done by [escallmatch](http://github.com/twada/escallmatch). Any arguments enclosed in bracket (for example, `[message]`) means optional parameters. Without bracket means mandatory parameters.


#### (optional) options.path

| type     | default value |
|:---------|:--------------|
| `string` | N/A           |

Filepath of `originalAst`. If passed, espower stores filepath information for reporting. This property is optional.


### var options = espower.defaultOptions();

Returns default options object for `espower` function. In other words, returns

```javascript
{
    destructive: false,
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


EXAMPLE
---------------------------------------

For given test file `example_test.js` below,

```javascript
var assert = require('power-assert'),
    truthy = 'true',
    falsy = 'false';
assert(falsy);
assert.equal(truthy, falsy);
```

Apply `espower` then generate modified code to console,

```javascript
var espower = require('espower'),
    esprima = require('esprima'),
    escodegen = require('escodegen'),
    fs = require('fs'),
    path = require('path');

var filepath = path.join(__dirname, 'example_test.js');
var jsAst = esprima.parse(fs.readFileSync(filepath), {tolerant: true, loc: true, tokens: true});
var modifiedAst = espower(jsAst, {path: filepath});

console.log(escodegen.generate(modifiedAst));
```

Output:

```javascript
var assert = require('power-assert'), truthy = 'true', falsy = 'false';
assert(assert._expr(assert._capt(falsy, 'arguments/0'), {
    content: 'assert(falsy)',
    filepath: '/path/to/example_test.js',
    line: 4
}));
assert.equal(assert._expr(assert._capt(truthy, 'arguments/0'), {
    content: 'assert.equal(truthy, falsy)',
    filepath: '/path/to/example_test.js',
    line: 5
}), assert._expr(assert._capt(falsy, 'arguments/1'), {
    content: 'assert.equal(truthy, falsy)',
    filepath: '/path/to/example_test.js',
    line: 5
}));
```


INSTALL
---------------------------------------

### via npm

Install

    $ npm install --save-dev espower


### via bower

Install

    $ bower install --save-dev espower

Then load (`espower` function is exported)

    <script type="text/javascript" src="./path/to/bower_components/espower/build/espower.js"></script>


AUTHOR
---------------------------------------
* [Takuto Wada](http://github.com/twada)


LICENSE
---------------------------------------
Licensed under the [MIT](https://github.com/twada/espower/blob/master/MIT-LICENSE.txt) license.
