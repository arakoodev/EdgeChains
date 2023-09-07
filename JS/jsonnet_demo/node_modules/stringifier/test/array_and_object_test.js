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

var stringify = stringifier.stringify;

describe('traverse', function () {
    describe('Array', function () {
        it('flat', function () {
            var input = [4, 5, 6];
            assert.equal(stringify(input), '[4,5,6]');
        });
        it('nested', function () {
            var input = [4, [5, [6, 7, 8], 9], 10];
            assert.equal(stringify(input), '[4,[5,[6,7,8],9],10]');
        });
    });


    describe('Array indentation', function () {
        it('empty array', function () {
            var input = [];
            assert.equal(stringify(input, {indent: '  '}), '[]');
        });
        it('3 items array', function () {
            var input = [3, 5, 8],
                expected = [
                    '[',
                    '  3,',
                    '  5,',
                    '  8',
                    ']'
                ].join('\n');
            assert.equal(stringify(input, {indent: '  '}), expected);
        });
        it('nested array', function () {
            var input = [4, [5, [6, 7, 8], 9], 10],
                expected = [
                    '[',
                    '  4,',
                    '  [',
                    '    5,',
                    '    [',
                    '      6,',
                    '      7,',
                    '      8',
                    '    ],',
                    '    9',
                    '  ],',
                    '  10',
                    ']'
                ].join('\n');
            assert.equal(stringify(input, {indent: '  '}), expected);
        });
        it('nested empty array', function () {
            var input = [3, [], 8],
                expected = [
                    '[',
                    '  3,',
                    '  [],',
                    '  8',
                    ']'
                ].join('\n');
            assert.equal(stringify(input, {indent: '  '}), expected);
        });
        it('nested array with maxDepth option', function () {
            var input = [3, [4, 5], 8],
                expected = [
                    '[',
                    '  3,',
                    '  #Array#,',
                    '  8',
                    ']'
                ].join('\n');
            assert.equal(stringify(input, {indent: '  ', maxDepth: 1}), expected);
        });
    });


    describe('Object indentation', function () {
        it('empty object', function () {
            var input = {};
            assert.equal(stringify(input, {indent: '  '}), 'Object{}');
        });
        it('two props object', function () {
            var input = {name: 'bob', age: 3},
                expected = [
                    'Object{',
                    '  name: "bob",',
                    '  age: 3',
                    '}'
                ].join('\n');
            assert.equal(stringify(input, {indent: '  '}), expected);
        });
        it('nested object', function () {
            var input = {a: 'A', b: {ba: 'BA', bb: 'BB'}, c: 4},
                expected = [
                    'Object{',
                    '  a: "A",',
                    '  b: Object{',
                    '    ba: "BA",',
                    '    bb: "BB"',
                    '  },',
                    '  c: 4',
                    '}'
                ].join('\n');
            assert.equal(stringify(input, {indent: '  '}), expected);
        });
        it('nested empty object', function () {
            var input = {a: 'A', b: {}, c: 4},
                expected = [
                    'Object{',
                    '  a: "A",',
                    '  b: Object{},',
                    '  c: 4',
                    '}'
                ].join('\n');
            assert.equal(stringify(input, {indent: '  '}), expected);
        });
        it('nested object with maxDepth option', function () {
            var input = {a: 'A', b: {ba: 'BA', bb: 'BB'}, c: 4},
                expected = [
                    'Object{',
                    '  a: "A",',
                    '  b: #Object#,',
                    '  c: 4',
                    '}'
                ].join('\n');
            assert.equal(stringify(input, {indent: '  ', maxDepth: 1}), expected);
        });
    });


    describe('circular references', function () {
        it('circular object', function () {
            var circularObj = {};
            circularObj.circularRef = circularObj;
            circularObj.list = [ circularObj, circularObj ];
            var expected = [
                'Object{',
                '  circularRef: #@Circular#,',
                '  list: [',
                '    #@Circular#,',
                '    #@Circular#',
                '  ]',
                '}'
            ].join('\n');
            assert.equal(stringify(circularObj, {indent: '  '}), expected);
        });
        it('circular array', function () {
            var circularArray = [3, 5];
            circularArray.push(circularArray);
            var expected = [
                '[',
                '  3,',
                '  5,',
                '  #@Circular#',
                ']'
            ].join('\n');
            assert.equal(stringify(circularArray, {indent: '  '}), expected);
        });
    });
});

}));
