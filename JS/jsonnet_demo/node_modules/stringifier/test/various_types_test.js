(function (root, factory) {
    'use strict';
    if (typeof define === 'function' && define.amd) {
        define(['stringifier', 'assert'], factory);
    } else if (typeof exports === 'object') {
        factory(require('..'), require('assert'));
    } else {
        factory(root.stringifier, root.assert);
    }
}(this, function (
    stringifier,
    assert
) {

function Person(name, age) {
    this.name = name;
    this.age = age;
}

var AnonPerson = function(name, age) {
    this.name = name;
    this.age = age;
};

var stringify = stringifier.stringify,
    keys = Object.keys,
    isPhantom = typeof window !== 'undefined' && typeof window.callPhantom === 'function',
    fixtures = {
        'string literal':  {
            input:    'foo',
            expected: '"foo"',
            pruned:   '"foo"'
        },
        'number literal':  {
            input:    5,
            expected: '5',
            pruned:   '5'
        },
        'boolean literal': {
            input:    false,
            expected: 'false',
            pruned:   'false'
        },
        'regexp literal':  {
            input:    /^not/,
            expected: '/^not/',
            pruned:   '/^not/'
        },
        'array literal':   {
            input:    ['foo', 4],
            expected: '["foo",4]',
            pruned:   '#Array#'
        },
        'object literal':  {
            input:    {name: 'bar'},
            expected: 'Object{name:"bar"}',
            pruned:   '#Object#'
        },
        'function expression': {
            input:    function () {},
            expected: '#function#',
            pruned:   '#function#'
        },
        'String object': {
            input:    new String('bar'),
            expected: 'new String("bar")',
            pruned:   'new String("bar")'
        },
        'Number object': {
            input:    new Number('3'),
            expected: 'new Number(3)',
            pruned:   'new Number(3)'
        },
        'Boolean object': {
            input:    new Boolean('1'),
            expected: 'new Boolean(true)',
            pruned:   'new Boolean(true)'
        },
        'Date object': {
            input:    new Date('1970-01-01'),
            expected: 'new Date("1970-01-01T00:00:00.000Z")',
            pruned:   'new Date("1970-01-01T00:00:00.000Z")'
        },
        'RegExp object': {
            input:    new RegExp('^not', 'g'),
            expected: '/^not/g',
            pruned:   '/^not/g'
        },
        'Array object': {
            input:    new Array(),
            expected: '[]',
            pruned:   '#Array#'
        },
        'Object object': {
            input:    new Object(),
            expected: 'Object{}',
            pruned:   '#Object#'
        },
        'Function object': {
            input:    new Function('x', 'y', 'return x + y'),
            expected: '#function#',
            pruned:   '#function#'
        },
        'Error object': {
            input:    new Error('error!'),
            expected: 'Error{}',
            pruned:   '#Error#'
        },
        'TypeError object': {
            input:    new TypeError('type error!'),
            expected: 'Error{}',
            pruned:   '#Error#'
        },
        'user-defined constructor': {
            input:    new Person('alice', 5),
            expected: 'Person{name:"alice",age:5}',
            pruned:   '#Person#'
        },
        'anonymous constructor': {
            input:    new AnonPerson('bob', 4),
            expected: '@Anonymous{name:"bob",age:4}',
            pruned:   '#@Anonymous#'
        },
        'NaN': {
            input:    NaN,
            expected: 'NaN',
            pruned:   'NaN'
        },
        'Infinity': {
            input:    Infinity,
            expected: 'Infinity',
            pruned:   'Infinity'
        },
        '-Infinity': {
            input:    -Infinity,
            expected: '-Infinity',
            pruned:   '-Infinity'
        },
        'Math': {
            input:    Math,
            expected: 'Math{}',
            pruned:   '#Math#'
        },
        'arguments object': {
            input:    (function(){ return arguments; })(),
            expected: 'Arguments{}',
            pruned:   '#Arguments#'
        },
        'null literal': {
            input:    null,
            expected: 'null',
            pruned:   'null'
        },
        'undefined value': {
            input:    undefined,
            expected: 'undefined',
            pruned:   'undefined'
        }
    };
if (isPhantom) {
    fixtures['Error object'].expected = 'Error{message:"error!"}';
    fixtures['TypeError object'].expected = 'Error{message:"type error!"}';
}
if (typeof JSON !== 'undefined') {
    fixtures['JSON'] = {
        input:    JSON,
        expected: 'JSON{}',
        pruned:   '#JSON#'
    };
}

describe('stringify', function () {
    var i, testKeys = keys(fixtures);
    for(i = 0; i < testKeys.length; i += 1) {
        (function(){
            var testTarget = testKeys[i],
                sut = fixtures[testTarget],
                input = sut.input;

            describe('without maxDepth option', function () {
                it('single ' + testTarget, function () {
                    assert.equal(stringify(input), sut.expected);
                });
                it('Array containing ' + testTarget, function () {
                    var ary = [];
                    ary.push(input);
                    assert.equal(stringify(ary), '[' + sut.expected + ']');
                });
                it('Object containing ' + testTarget, function () {
                    var obj = {};
                    obj.val = input;
                    assert.equal(stringify(obj), 'Object{val:' + sut.expected + '}');
                });
            });

            describe('with maxDepth = 1', function () {
                it('single ' + testTarget, function () {
                    assert.equal(stringify(input, {maxDepth: 1}), sut.expected);
                });
                it('Array containing ' + testTarget, function () {
                    var ary = [];
                    ary.push(input);
                    assert.equal(stringify(ary, {maxDepth: 1}), '[' + sut.pruned + ']');
                });
                it('Object containing ' + testTarget, function () {
                    var obj = {};
                    obj.val = input;
                    assert.equal(stringify(obj, {maxDepth: 1}), 'Object{val:' + sut.pruned + '}');
                });
            });

            it('non-regular prop name' + testTarget, function () {
                var obj = {};
                obj['^pr"op-na:me'] = input;
                assert.equal(stringify(obj, {maxDepth: 1}), 'Object{"^pr\\"op-na:me":' + sut.pruned + '}');
            });
        })();
    }
});

}));
