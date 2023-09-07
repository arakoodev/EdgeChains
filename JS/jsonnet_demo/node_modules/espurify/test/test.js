var espurify = require('..'),
    esprima = require('esprima'),
    estraverse = require('estraverse'),
    syntax = estraverse.Syntax,
    assert = require('assert');


describe('eliminate extra properties from AST output', function () {

    beforeEach(function () {
        this.expected = {
            type: 'Program',
            body: [
                {
                    type: 'ExpressionStatement',
                    expression: {
                        type: 'CallExpression',
                        callee: {
                            type: 'Identifier',
                            name: 'assert'
                        },
                        arguments: [
                            {
                                type: 'Literal',
                                value: 'foo'
                            }
                        ]
                    }
                }
            ]
        };
    });



    it('eliminate tokens and raw', function () {
        var ast = esprima.parse('assert("foo")', {tolerant: true, tokens: true, raw: true});
        var purified = espurify(ast);

        assert.deepEqual(ast, {
            type: 'Program',
            body: [
                {
                    type: 'ExpressionStatement',
                    expression: {
                        type: 'CallExpression',
                        callee: {
                            type: 'Identifier',
                            name: 'assert'
                        },
                        arguments: [
                            {
                                type: 'Literal',
                                value: 'foo',
                                raw: '"foo"'
                            }
                        ]
                    }
                }
            ],
            tokens: [
                {
                    type: 'Identifier',
                    value: 'assert'
                },
                {
                    type: 'Punctuator',
                    value: '('
                },
                {
                    type: 'String',
                    value: '"foo"'
                },
                {
                    type: 'Punctuator',
                    value: ')'
                }
            ],
            errors: []
        });

        assert.deepEqual(purified, this.expected);
    });



    it('eliminate range', function () {
        var ast = esprima.parse('assert("foo")', {tolerant: true, range: true});
        var purified = espurify(ast);
        assert.deepEqual(ast, {
            type: 'Program',
            body: [
                {
                    type: 'ExpressionStatement',
                    expression: {
                        type: 'CallExpression',
                        callee: {
                            type: 'Identifier',
                            name: 'assert',
                            range: [
                                0,
                                6
                            ]
                        },
                        arguments: [
                            {
                                type: 'Literal',
                                value: 'foo',
                                raw: '"foo"',
                                range: [
                                    7,
                                    12
                                ]
                            }
                        ],
                        range: [
                            0,
                            13
                        ]
                    },
                    range: [
                        0,
                        13
                    ]
                }
            ],
            range: [
                0,
                13
            ],
            errors: []
        });
        assert.deepEqual(purified, this.expected);
    });



    it('eliminate loc', function () {
        var ast = esprima.parse('assert("foo")', {tolerant: true, loc: true});
        var purified = espurify(ast);

        assert.deepEqual(ast, {
            type: 'Program',
            body: [
                {
                    type: 'ExpressionStatement',
                    expression: {
                        type: 'CallExpression',
                        callee: {
                            type: 'Identifier',
                            name: 'assert',
                            loc: {
                                start: {
                                    line: 1,
                                    column: 0
                                },
                                end: {
                                    line: 1,
                                    column: 6
                                }
                            }
                        },
                        arguments: [
                            {
                                type: 'Literal',
                                value: 'foo',
                                raw: '"foo"',
                                loc: {
                                    start: {
                                        line: 1,
                                        column: 7
                                    },
                                    end: {
                                        line: 1,
                                        column: 12
                                    }
                                }
                            }
                        ],
                        loc: {
                            start: {
                                line: 1,
                                column: 0
                            },
                            end: {
                                line: 1,
                                column: 13
                            }
                        }
                    },
                    loc: {
                        start: {
                            line: 1,
                            column: 0
                        },
                        end: {
                            line: 1,
                            column: 13
                        }
                    }
                }
            ],
            loc: {
                start: {
                    line: 1,
                    column: 0
                },
                end: {
                    line: 1,
                    column: 13
                }
            },
            errors: []
        });

        assert.deepEqual(purified, this.expected);
    });



    it('eliminate custom property', function () {
        var ast = esprima.parse('assert("foo")', {tolerant: true, raw: true});
        estraverse.replace(ast, {
            leave: function (currentNode, parentNode) {
                if (currentNode.type === syntax.Literal && typeof currentNode.raw !== 'undefined') {
                    currentNode['x-verbatim-bar'] = {
                        content : currentNode.raw,
                        precedence : 18  // escodegen.Precedence.Primary
                    };
                    return currentNode;
                } else {
                    return undefined;
                }
            }
        });
        var purified = espurify(ast);

        assert.deepEqual(ast, {
            type: 'Program',
            body: [
                {
                    type: 'ExpressionStatement',
                    expression: {
                        type: 'CallExpression',
                        callee: {
                            type: 'Identifier',
                            name: 'assert'
                        },
                        arguments: [
                            {
                                type: 'Literal',
                                value: 'foo',
                                raw: '"foo"',
                                "x-verbatim-bar": {
                                    content: '"foo"',
                                    precedence: 18
                                }
                            }
                        ]
                    }
                }
            ],
            errors: []
        });

        assert.deepEqual(purified, this.expected);
    });

});
