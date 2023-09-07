(function (root, factory) {
    'use strict';
    if (typeof define === 'function' && define.amd) {
        define(['escallmatch', 'esprima', 'estraverse', 'espurify', 'assert'], factory);
    } else if (typeof exports === 'object') {
        factory(require('..'), require('esprima'), require('estraverse'), require('espurify'), require('assert'));
    } else {
        factory(root.escallmatch, root.esprima, root.estraverse, root.espurify, root.assert);
    }
}(this, function (
    escallmatch,
    esprima,
    estraverse,
    espurify,
    assert
) {


    function matchCode (matcher, targetCode) {
        var esprimaOptions = {tolerant: true, loc: true, tokens: true, raw: true};
        var ast = esprima.parse(targetCode, esprimaOptions);
        var calls = [];
        var args = [];
        var captured = {};
        estraverse.traverse(ast, {
            leave: function (currentNode, parentNode) {
                if (matcher.test(currentNode)) {
                    calls.push(currentNode);
                }
                var matched = matcher.matchArgument(currentNode, parentNode);
                if (matched) {
                    args.push(matched);
                    captured[matched.name] = currentNode;
                }
            }
        });
        return {
            calls: calls,
            args: args,
            captured: captured
        };
    }


    describe('function/method signature validation', function () {
        it('syntax error', function () {
            assert.throws(function () {
                escallmatch('assert(actual, ');
            }, Error);
        });
        describe('Argument should be in the form of CallExpression', function () {
            it('not a CallExpression', function () {
                assert.throws(function () {
                    escallmatch('bar[baz]');
                }, /Argument should be in the form of CallExpression/);
            });
            it('not an ExpressionStatement', function () {
                assert.throws(function () {
                    escallmatch('var foo = bar[baz]');
                }, /Argument should be in the form of CallExpression/);
            });
        });
        describe('argument name should be unique', function () {
            it('unique identifier', function () {
                assert.throws(function () {
                    escallmatch('assert(actual, actual)');
                }, /Duplicate argument name: actual/);
            });
            it('unique even if in array', function () {
                assert.throws(function () {
                    escallmatch('assert(actual, [actual])');
                }, /Duplicate argument name: actual/);
            });
        });
        describe('argument should be in the form of `name` or `[name]`', function () {
            it('not an Identifier or an ArrayExpression', function () {
                assert.throws(function () {
                    escallmatch('assert(actual, {foo: "bar"})');
                }, /Argument should be in the form of `name` or `\[name\]`/);
            });
            it('empty array', function () {
                assert.throws(function () {
                    escallmatch('assert(actual, [])');
                }, /Argument should be in the form of `name` or `\[name\]`/);
            });
            it('array having more than one element', function () {
                assert.throws(function () {
                    escallmatch('assert(actual, [foo, bar])');
                }, /Argument should be in the form of `name` or `\[name\]`/);
            });
            it('array element is not an Identifier', function () {
                assert.throws(function () {
                    escallmatch('assert(actual, [3])');
                }, /Argument should be in the form of `name` or `\[name\]`/);
            });
        });
    });


    describe('optional parameter variations', function () {
        describe ('JSON.stringify(value, [replacer], [space])', function () {
            beforeEach(function () {
                this.matcher = escallmatch('JSON.stringify(value, [replacer], [space])');
            });
            it('#calleeAst', function () {
                assert.deepEqual(this.matcher.calleeAst(), {
                    type: 'MemberExpression',
                    computed: false,
                    object: {
                        type: 'Identifier',
                        name: 'JSON'
                    },
                    property: {
                        type: 'Identifier',
                        name: 'stringify'
                    }
                });
            });
            it('#argumentSignatures', function () {
                assert.deepEqual(this.matcher.argumentSignatures(), [
                    {name: 'value', kind: 'mandatory'},
                    {name: 'replacer', kind: 'optional'},
                    {name: 'space', kind: 'optional'}
                ]);
            });
            it ('match against "console.log(JSON.stringify(val));"', function () {
                var code = 'console.log(JSON.stringify(val));';
                var matched = matchCode(this.matcher, code);
                assert.equal(matched.calls.length, 1);
                assert.equal(matched.args.length, 1);
                assert.deepEqual(matched.args[0], {name: 'value', kind: 'mandatory'});
            });
            it ('match against "console.log(JSON.stringify(val, replacerFn));"', function () {
                var code = 'console.log(JSON.stringify(val, replacerFn));';
                var matched = matchCode(this.matcher, code);
                assert.equal(matched.calls.length, 1);
                assert.equal(matched.args.length, 2);
                assert.deepEqual(matched.args[0], {name: 'value', kind: 'mandatory'});
                assert.deepEqual(matched.args[1], {name: 'replacer', kind: 'optional'});
            });
            it ('match against "console.log(JSON.stringify(val, replacerFn, 2));"', function () {
                var code = 'console.log(JSON.stringify(val, replacerFn, 2));';
                var matched = matchCode(this.matcher, code);
                assert.equal(matched.calls.length, 1);
                assert.equal(matched.args.length, 3);
                assert.deepEqual(matched.args[0], {name: 'value', kind: 'mandatory'});
                assert.deepEqual(matched.args[1], {name: 'replacer', kind: 'optional'});
                assert.deepEqual(matched.args[2], {name: 'space', kind: 'optional'});
            });
        });
        describe ('bizarre(foo, [bar], [baz], qux)', function () {
            beforeEach(function () {
                this.matcher = escallmatch('bizarre(foo, [bar], [baz], qux)');
            });
            it('#calleeAst', function () {
                assert.deepEqual(this.matcher.calleeAst(), {
                    type: 'Identifier',
                    name: 'bizarre'
                });
            });
            it('#argumentSignatures', function () {
                assert.deepEqual(this.matcher.argumentSignatures(), [
                    {name: 'foo', kind: 'mandatory'},
                    {name: 'bar', kind: 'optional'},
                    {name: 'baz', kind: 'optional'},
                    {name: 'qux', kind: 'mandatory'}
                ]);
            });
            it ('match against "bizarre(spam, ham);"', function () {
                var code = 'bizarre(spam, ham);';
                var matched = matchCode(this.matcher, code);
                assert.equal(matched.calls.length, 1);
                assert.equal(matched.args.length, 2);
                assert.deepEqual(matched.args[0], {name: 'foo', kind: 'mandatory'});
                assert.deepEqual(matched.args[1], {name: 'qux', kind: 'mandatory'});
            });
            it ('match against "bizarre(spam, ham, egg);"', function () {
                var code = 'bizarre(spam, ham, egg);';
                var matched = matchCode(this.matcher, code);
                assert.equal(matched.calls.length, 1);
                assert.equal(matched.args.length, 3);
                assert.deepEqual(matched.args[0], {name: 'foo', kind: 'mandatory'});
                assert.deepEqual(matched.args[1], {name: 'bar', kind: 'optional'});
                assert.deepEqual(matched.args[2], {name: 'qux', kind: 'mandatory'});
            });
            it ('match against "bizarre(spam, ham, egg, sausage);"', function () {
                var code = 'bizarre(spam, ham, egg, sausage);';
                var matched = matchCode(this.matcher, code);
                assert.equal(matched.calls.length, 1);
                assert.equal(matched.args.length, 4);
                assert.deepEqual(matched.args[0], {name: 'foo', kind: 'mandatory'});
                assert.deepEqual(matched.args[1], {name: 'bar', kind: 'optional'});
                assert.deepEqual(matched.args[2], {name: 'baz', kind: 'optional'});
                assert.deepEqual(matched.args[3], {name: 'qux', kind: 'mandatory'});
            });
        });
    });


    describe('optional parameter in the middle, glob(pattern, [options], cb)', function () {
        beforeEach(function () {
            this.matcher = escallmatch('glob(pattern, [options], cb)');
        });
        it('#calleeAst', function () {
            assert.deepEqual(this.matcher.calleeAst(), {
                type: 'Identifier',
                name: 'glob'
            });
        });
        it('#argumentSignatures', function () {
            assert.deepEqual(this.matcher.argumentSignatures(), [
                {name: 'pattern', kind: 'mandatory'},
                {name: 'options', kind: 'optional'},
                {name: 'cb', kind: 'mandatory'}
            ]);
        });
        it('three args', function () {
            var code = '';
            code += 'var glob = require("glob");';
            code += 'glob("**/*.js", opts, function (er, files) {';
            code += '    if (er) console.log(er);';
            code += '    console.log(JSON.stringify(files));';
            code += '});';
            var matched = matchCode(this.matcher, code);
            assert.equal(matched.calls.length, 1);
            assert.equal(matched.args.length, 3);
            assert.deepEqual(matched.args[0], {name: 'pattern', kind: 'mandatory'});
            assert.deepEqual(matched.args[1], {name: 'options', kind: 'optional'});
            assert.deepEqual(matched.args[2], {name: 'cb', kind: 'mandatory'});
            assert(matched.captured['pattern']);
            assert(matched.captured['options']);
            assert(matched.captured['cb']);
            assert.deepEqual(espurify(matched.captured['pattern']), {
                type: 'Literal',
                value: '**/*.js'
            });
            assert.deepEqual(espurify(matched.captured['options']), {
                type: 'Identifier',
                name: 'opts'
            });
            assert.equal(espurify(matched.captured['cb']).type, 'FunctionExpression');
        });
        it('two args', function () {
            var code = '';
            code += 'var glob = require("glob");';
            code += 'glob("**/*.js", function (er, files) {';
            code += '    if (er) console.log(er);';
            code += '    console.log(JSON.stringify(files));';
            code += '});';
            var matched = matchCode(this.matcher, code);
            assert.equal(matched.calls.length, 1);
            assert.equal(matched.args.length, 2);
            assert.deepEqual(matched.args[0], {name: 'pattern', kind: 'mandatory'});
            assert.deepEqual(matched.args[1], {name: 'cb', kind: 'mandatory'});
            assert(matched.captured['pattern']);
            assert(! matched.captured['options']);
            assert(matched.captured['cb']);
            assert.deepEqual(espurify(matched.captured['pattern']), {
                type: 'Literal',
                value: '**/*.js'
            });
            assert.equal(espurify(matched.captured['cb']).type, 'FunctionExpression');
        });
    });


    describe('optional parameter assert(actual, [message])', function () {
        beforeEach(function () {
            this.matcher = escallmatch('assert(actual, [message])');
        });
        it('with message', function () {
            var matched = matchCode(this.matcher, 'it("test foo", function () { assert(foo, "message"); })');
            assert.equal(matched.calls.length, 1);
            assert.equal(matched.args.length, 2);
            assert.deepEqual(matched.args[0], {name: 'actual', kind: 'mandatory'});
            assert.deepEqual(matched.args[1], {name: 'message', kind: 'optional'});
            assert(matched.captured['actual']);
            assert(matched.captured['message']);
            assert.deepEqual(espurify(matched.captured['actual']), {
                type: 'Identifier',
                name: 'foo'
            });
            assert.deepEqual(espurify(matched.captured['message']), {
                type: 'Literal',
                value: 'message'
            });
        });
        it('without message', function () {
            var matched = matchCode(this.matcher, 'it("test foo", function () { assert(foo); })');
            assert.equal(matched.calls.length, 1);
            assert.equal(matched.args.length, 1);
            assert(matched.captured['actual']);
            assert.deepEqual(espurify(matched.captured['actual']), {
                type: 'Identifier',
                name: 'foo'
            });
        });
        it('#calleeAst', function () {
            assert.deepEqual(this.matcher.calleeAst(), {
                type: 'Identifier',
                name: 'assert'
            });
        });
        it('#argumentSignatures', function () {
            assert.deepEqual(this.matcher.argumentSignatures(), [
                {name: 'actual', kind: 'mandatory'},
                {name: 'message', kind: 'optional'}
            ]);
        });
    });


    describe('one argument assert(actual)', function () {
        beforeEach(function () {
            this.matcher = escallmatch('assert(actual)');
        });
        it('single identifier', function () {
            var matched = matchCode(this.matcher, 'it("test foo", function () { assert(foo); })');
            assert.equal(matched.calls.length, 1);
            assert.equal(matched.args.length, 1);
            assert.deepEqual(matched.args[0], {name: 'actual', kind: 'mandatory'});
            assert.deepEqual(espurify(matched.calls[0]), {
                type: 'CallExpression',
                callee: {
                    type: 'Identifier',
                    name: 'assert'
                },
                arguments: [
                    {
                        type: 'Identifier',
                        name: 'foo'
                    }
                ]
            });
            assert.deepEqual(espurify(matched.captured['actual']), {
                type: 'Identifier',
                name: 'foo'
            });
        });
        it('optional parameter', function () {
            var matched = matchCode(this.matcher, 'it("test foo", function () { assert(foo, "message"); })');
            assert.equal(matched.calls.length, 0);
            assert.equal(matched.args.length, 0);
            assert(! matched.captured['actual']);
        });
        it('no params', function () {
            var matched = matchCode(this.matcher, 'it("test foo", function () { assert(); })');
            assert.equal(matched.calls.length, 0);
            assert.equal(matched.args.length, 0);
            assert(! matched.captured['actual']);
        });
        it('#calleeAst', function () {
            assert.deepEqual(this.matcher.calleeAst(), {
                type: 'Identifier',
                name: 'assert'
            });
        });
        it('#argumentSignatures', function () {
            assert.deepEqual(this.matcher.argumentSignatures(), [
                {name: 'actual', kind: 'mandatory'}
            ]);
        });
    });


    describe('two args assert.equal(actual, expected)', function () {
        beforeEach(function () {
            this.matcher = escallmatch('assert.equal(actual, expected)');
        });
        it('capture arguments', function () {
            var matched = matchCode(this.matcher, 'it("test foo and bar", function () { assert.equal(foo, bar); })');
            assert.equal(matched.calls.length, 1);
            assert.equal(matched.args.length, 2);
            assert.deepEqual(matched.args[0], {name: 'actual', kind: 'mandatory'});
            assert.deepEqual(matched.args[1], {name: 'expected', kind: 'mandatory'});
            assert(matched.captured['actual']);
            assert.equal(matched.captured['actual'].name, 'foo');
            assert(matched.captured['expected']);
            assert.equal(matched.captured['expected'].name, 'bar');
            assert.deepEqual(espurify(matched.calls[0]), {
                type: 'CallExpression',
                callee: {
                    type: 'MemberExpression',
                    computed: false,
                    object: {
                        type: 'Identifier',
                        name: 'assert'
                    },
                    property: {
                        type: 'Identifier',
                        name: 'equal'
                    }
                },
                arguments: [
                    {
                        type: 'Identifier',
                        name: 'foo'
                    },
                    {
                        type: 'Identifier',
                        name: 'bar'
                    }
                ]
            });
            assert.deepEqual(espurify(matched.captured['actual']), {
                type: 'Identifier',
                name: 'foo'
            });
            assert.deepEqual(espurify(matched.captured['expected']), {
                type: 'Identifier',
                name: 'bar'
            });
        });
        it('optional parameters', function () {
            var matched = matchCode(this.matcher, 'it("test foo and bar", function () { assert.equal(foo, bar, "message"); })');
            assert.equal(matched.calls.length, 0);
            assert.equal(matched.args.length, 0);
            assert(! matched.captured['actual']);
            assert(! matched.captured['expected']);
        });
        it('less parameters', function () {
            var matched = matchCode(this.matcher, 'it("test foo and bar", function () { assert.equal(foo); })');
            assert.equal(matched.calls.length, 0);
            assert.equal(matched.args.length, 0);
            assert(! matched.captured['actual']);
            assert(! matched.captured['expected']);
        });
        it('#calleeAst', function () {
            assert.deepEqual(this.matcher.calleeAst(), {
                type: 'MemberExpression',
                computed: false,
                object: {
                    type: 'Identifier',
                    name: 'assert'
                },
                property: {
                    type: 'Identifier',
                    name: 'equal'
                }
            });
        });
        it('#argumentSignatures', function () {
            assert.deepEqual(this.matcher.argumentSignatures(), [
                {name: 'actual', kind: 'mandatory'},
                {name: 'expected', kind: 'mandatory'}
            ]);
        });
    });


    describe('comparing CallExpression depth', function () {
        it('deeper callee tree', function () {
            var matcher = escallmatch('assert.equal(actual, expected)');
            var matched = matchCode(matcher, 'it("zombie like test", function () { browser.assert.equal(foo, bar); })');
            assert.equal(matched.calls.length, 0);
        });
        it('shallower callee tree', function () {
            var matcher = escallmatch('assert.equal(actual, expected)');
            var matched = matchCode(matcher, 'it("simple assert", function () { assert(foo); })');
            assert.equal(matched.calls.length, 0);
        });
    });


    it('not Identifier', function () {
        var matcher = escallmatch('assert.equal(actual, expected)');
        var matched = matchCode(matcher, 'it("test3", function () { assert.equal(toto.tata(baz), moo[0]); })');

        assert.equal(matched.calls.length, 1);
        assert.deepEqual(espurify(matched.calls[0]), {
            type: 'CallExpression',
            callee: {
                type: 'MemberExpression',
                computed: false,
                object: {
                    type: 'Identifier',
                    name: 'assert'
                },
                property: {
                    type: 'Identifier',
                    name: 'equal'
                }
            },
            arguments: [
                {
                    type: 'CallExpression',
                    callee: {
                        type: 'MemberExpression',
                        computed: false,
                        object: {
                            type: 'Identifier',
                            name: 'toto'
                        },
                        property: {
                            type: 'Identifier',
                            name: 'tata'
                        }
                    },
                    arguments: [
                        {
                            type: 'Identifier',
                            name: 'baz'
                        }
                    ]
                },
                {
                    type: 'MemberExpression',
                    computed: true,
                    object: {
                        type: 'Identifier',
                        name: 'moo'
                    },
                    property: {
                        type: 'Literal',
                        value: 0
                    }
                }
            ]
        });

        assert.equal(matched.args.length, 2);
        assert.deepEqual(matched.args[0], {name: 'actual', kind: 'mandatory'});
        assert.deepEqual(matched.args[1], {name: 'expected', kind: 'mandatory'});

        assert.deepEqual(espurify(matched.captured['actual']), {
            type: 'CallExpression',
            callee: {
                type: 'MemberExpression',
                computed: false,
                object: {
                    type: 'Identifier',
                    name: 'toto'
                },
                property: {
                    type: 'Identifier',
                    name: 'tata'
                }
            },
            arguments: [
                {
                    type: 'Identifier',
                    name: 'baz'
                }
            ]
        });
        assert.deepEqual(espurify(matched.captured['expected']), {
            type: 'MemberExpression',
            computed: true,
            object: {
                type: 'Identifier',
                name: 'moo'
            },
            property: {
                type: 'Literal',
                value: 0
            }
        });
    });


}));
