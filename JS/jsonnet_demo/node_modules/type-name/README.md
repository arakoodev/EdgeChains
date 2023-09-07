type-name
================================

Just a reasonable `typeof`

[![Build Status](https://travis-ci.org/twada/type-name.svg?branch=master)](https://travis-ci.org/twada/type-name)
[![NPM version](https://badge.fury.io/js/type-name.svg)](http://badge.fury.io/js/type-name)
[![Dependency Status](https://gemnasium.com/twada/type-name.svg)](https://gemnasium.com/twada/type-name)
[![License](http://img.shields.io/badge/license-MIT-brightgreen.svg)](http://twada.mit-license.org/)

[![browser support](https://ci.testling.com/twada/type-name.png)](https://ci.testling.com/twada/type-name)


DESCRIPTION
---------------------------------------

`typeName` function returns reasonable type name for input value.

| description    | input   | result      |
|:---------------|:--------|:------------|
| string literal | `'foo'` | `'string'` |
| number literal | `5` | `'number'` |
| boolean literal | `false` | `'boolean'` |
| regexp literal | `/^not/` | `'RegExp'` |
| array literal | `['foo', 4]` | `'Array'` |
| object literal | `{name: 'bar'}` | `'Object'` *(be careful!)* |
| function expression | `function () {}` | `'function'` |
| String object | `new String('foo')` | `'String'` |
| Number object | `new Number('3')` | `'Number'` |
| Boolean object |`new Boolean('1')` | `'Boolean'` |
| Date object | `new Date()` | `'Date'` |
| RegExp object | `new RegExp('^not', 'g')` | `'RegExp'` |
| Array object | `new Array()` | `'Array'` |
| Object object | `new Object()` | `'Object'` |
| Function object | `new Function('x', 'y', 'return x + y')` | `'function'` *(be careful!)* |
| Error object | `new Error('error!')` | `'Error'` |
| NaN | `NaN` | `'number'` |
| Infinity | `Infinity` | `'number'` |
| Math | `Math` | `'Math'` |
| JSON *(IE8+)* | `JSON` | `'JSON'` |
| arguments object *(IE9+)*  | `(function(){ return arguments; })()` | `'Arguments'` |
| null literal | `null` | `'null'` |
| undefined value | `undefined` | `'undefined'` |
| User-defined constructor | `new Person('alice', 5)` | `'Person'` |
| Anonymous constructor | `new AnonPerson('bob', 4)` | `''` |


EXAMPLE
---------------------------------------

```javascript
var typeName = require('type-name'),
    assert = require('assert');

assert(typeName('foo') === 'string');
assert(typeName(5) === 'number');
assert(typeName(false) === 'boolean');
assert(typeName(/^not/) === 'RegExp');
assert(typeName(['foo', 4]) === 'Array');
assert(typeName({name: 'bar'}) === 'Object');
assert(typeName(function () {}) === 'function');
assert(typeName(new String('foo')) === 'String');
assert(typeName(new Number('3')) === 'Number');
assert(typeName(new Boolean('1')) === 'Boolean');
assert(typeName(new Date()) === 'Date');
assert(typeName(new RegExp('^not', 'g')) === 'RegExp');
assert(typeName(new Array()) === 'Array');
assert(typeName(new Object()) === 'Object');
assert(typeName(new Function('x', 'y', 'return x + y')) === 'function');
assert(typeName(new Error('error!')) === 'Error');
assert(typeName(NaN) === 'number');
assert(typeName(Infinity) === 'number');
assert(typeName(Math) === 'Math');
assert(typeName(JSON) === 'JSON'); // IE8+
assert(typeName((function(){ return arguments; })()) === 'Arguments');  // IE9+
assert(typeName(null) === 'null');
assert(typeName(undefined) === 'undefined');

function Person(name, age) {
    this.name = name;
    this.age = age;
}

var AnonPerson = function(name, age) {
    this.name = name;
    this.age = age;
};

assert(typeName(new Person('alice', 5)) === 'Person');
assert(typeName(new AnonPerson('bob', 4)) === '');
```


INSTALL
---------------------------------------

### via npm

Install

    $ npm install --save type-name

Use

```javascript
var typeName = require('type-name');
console.log(typeName(anyVar));
```

### via bower

Install

    $ bower install --save type-name

Load (`typeName` function is exported)

    <script type="text/javascript" src="./path/to/bower_components/type-name/build/type-name.js"></script>

Use

```javascript
console.log(typeName(anyVar));
```

### via component

Install and build

    $ component install twada/type-name
    $ component build

Then use as usual.


AUTHOR
---------------------------------------
* [Takuto Wada](http://github.com/twada)


CONTRIBUTORS
---------------------------------------
* [azu](https://github.com/azu)
* [Yosuke Furukawa](https://github.com/yosuke-furukawa)


LICENSE
---------------------------------------
Licensed under the [MIT](http://twada.mit-license.org/) license.
