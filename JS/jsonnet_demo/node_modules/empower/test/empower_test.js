(function (root, factory) {
    'use strict';
    if (typeof define === 'function' && define.amd) {
        define(['empower', 'espower-source', 'assert'], factory);
    } else if (typeof exports === 'object') {
        factory(require('..'), require('espower-source'), require('assert'));
    } else {
        factory(root.empower, root.espowerSource, root.assert);
    }
}(this, function (
    empower,
    espowerSource,
    baseAssert
) {
    var weave = function (line) {
        return espowerSource(line, '/path/to/some_test.js');
    },
    fakeFormatter = function (context) {
        var events = context.args.reduce(function (accum, arg) {
            return accum.concat(arg.events);
        }, []);
        return [
            context.source.filepath,
            context.source.content,
            JSON.stringify(events)
        ].join('\n');
    };


test('default options behavior', function () {
    var weave = function (line) {
        return espowerSource(line, '/path/to/some_test.js');
    };
    var assert = empower(baseAssert, fakeFormatter);

    var falsy = 0;
    try {
        eval(weave('assert(falsy);'));
        baseAssert.ok(false, 'AssertionError should be thrown');
    } catch (e) {
        baseAssert.equal(e.name, 'AssertionError');
        baseAssert.equal(e.message, [
            '/path/to/some_test.js',
            'assert(falsy)',
            '[{"value":0,"espath":"arguments/0"}]'
        ].join('\n'));
    }
});


function testWithOption (option) {
    var assert = empower(baseAssert, fakeFormatter, option);


test('Bug reproduction. should not fail if argument is null Literal. ' + JSON.stringify(option), function () {
    var foo = 'foo';
    try {
        eval(weave('assert.equal(foo, null);'));
        baseAssert.ok(false, 'AssertionError should be thrown');
    } catch (e) {
        baseAssert.equal(e.name, 'AssertionError');
        if (option.modifyMessageOnRethrow) {
            baseAssert.equal(e.message, [
                '/path/to/some_test.js',
                'assert.equal(foo, null)',
                '[{"value":"foo","espath":"arguments/0"}]'
            ].join('\n'));
        }
        if (option.saveContextOnRethrow) {
            baseAssert.deepEqual(e.powerAssertContext, {
                "source":{
                    "content":"assert.equal(foo, null)",
                    "filepath":"/path/to/some_test.js",
                    "line": 1
                },
                "args":[
                    {
                        "value":"foo",
                        "events":[{"value":"foo","espath":"arguments/0"}]
                    }
                ]
            });
        }
    }
});


test('assertion with optional message argument. ' + JSON.stringify(option), function () {
    var falsy = 0;
    try {
        eval(weave('assert(falsy, "assertion message");'));
        baseAssert.ok(false, 'AssertionError should be thrown');
    } catch (e) {
        baseAssert.equal(e.name, 'AssertionError');
        if (option.modifyMessageOnRethrow) {
            baseAssert.equal(e.message, [
                'assertion message /path/to/some_test.js',
                'assert(falsy, "assertion message")',
                '[{"value":0,"espath":"arguments/0"}]'
            ].join('\n'));
        }
        if (option.saveContextOnRethrow) {
            baseAssert.deepEqual(e.powerAssertContext, {
                "source":{
                    "content": "assert(falsy, \"assertion message\")",
                    "filepath": "/path/to/some_test.js",
                    "line": 1
                },
                "args":[
                    {
                        "value": 0,
                        "events": [
                            {"value":0,"espath":"arguments/0"}
                        ]
                    }
                ]
            });
        }
    }
});


test(JSON.stringify(option) + ' empowered function also acts like an assert function', function () {
    var falsy = 0;
    try {
        eval(weave('assert(falsy);'));
        baseAssert.ok(false, 'AssertionError should be thrown');
    } catch (e) {
        baseAssert.equal(e.name, 'AssertionError');
        if (option.modifyMessageOnRethrow) {
            baseAssert.equal(e.message, [
                '/path/to/some_test.js',
                'assert(falsy)',
                '[{"value":0,"espath":"arguments/0"}]'
            ].join('\n'));
        }
        if (option.saveContextOnRethrow) {
            baseAssert.deepEqual(e.powerAssertContext, {
                "source":{
                    "content": "assert(falsy)",
                    "filepath": "/path/to/some_test.js",
                    "line": 1
                },
                "args":[
                    {
                        "value": 0,
                        "events": [
                            {"value":0,"espath":"arguments/0"}
                        ]
                    }
                ]
            });
        }
    }
});


suite(JSON.stringify(option) + ' assertion method with one argument', function () {
    test('Identifier', function () {
        var falsy = 0;
        try {
            eval(weave('assert.ok(falsy);'));
            baseAssert.ok(false, 'AssertionError should be thrown');
        } catch (e) {
            baseAssert.equal(e.name, 'AssertionError');
            if (option.modifyMessageOnRethrow) {
                baseAssert.equal(e.message, [
                    '/path/to/some_test.js',
                    'assert.ok(falsy)',
                    '[{"value":0,"espath":"arguments/0"}]'
                ].join('\n'));
            }
            if (option.saveContextOnRethrow) {
                baseAssert.deepEqual(e.powerAssertContext, {
                    "source": {
                        "content":"assert.ok(falsy)",
                        "filepath":"/path/to/some_test.js",
                        "line": 1
                    },
                    "args":[
                        {
                            "value":0,
                            "events":[
                                {"value":0,"espath":"arguments/0"}
                            ]
                        }
                    ]
                });
            }
        }
    });
});


suite(JSON.stringify(option) + ' assertion method with two arguments', function () {
    test('both Identifier', function () {
        var foo = 'foo', bar = 'bar';
        try {
            eval(weave('assert.equal(foo, bar);'));
            baseAssert.ok(false, 'AssertionError should be thrown');
        } catch (e) {
            baseAssert.equal(e.name, 'AssertionError');
            if (option.modifyMessageOnRethrow) {
                baseAssert.equal(e.message, [
                    '/path/to/some_test.js',
                    'assert.equal(foo, bar)',
                    '[{"value":"foo","espath":"arguments/0"},{"value":"bar","espath":"arguments/1"}]'
                ].join('\n'));
            }
            if (option.saveContextOnRethrow) {
                baseAssert.deepEqual(e.powerAssertContext, {
                    "source":{
                        "content":"assert.equal(foo, bar)",
                        "filepath":"/path/to/some_test.js",
                        "line": 1
                    },
                    "args":[
                        {
                            "value":"foo",
                            "events":[{"value":"foo","espath":"arguments/0"}]
                        },
                        {
                            "value":"bar",
                            "events":[{"value":"bar","espath":"arguments/1"}]
                        }
                    ]
                });
            }
        }
    });

    test('first argument is Literal', function () {
        var bar = 'bar';
        try {
            eval(weave('assert.equal("foo", bar);'));
            baseAssert.ok(false, 'AssertionError should be thrown');
        } catch (e) {
            baseAssert.equal(e.name, 'AssertionError');
            if (option.modifyMessageOnRethrow) {
                baseAssert.equal(e.message, [
                    '/path/to/some_test.js',
                    'assert.equal("foo", bar)',
                    '[{"value":"bar","espath":"arguments/1"}]'
                ].join('\n'));
            }
            if (option.saveContextOnRethrow) {
                baseAssert.deepEqual(e.powerAssertContext, {
                    "source":{
                        "content":"assert.equal(\"foo\", bar)",
                        "filepath":"/path/to/some_test.js",
                        "line": 1
                    },
                    "args": [
                        {
                            "value": "bar",
                            "events": [{"value":"bar","espath":"arguments/1"}]
                        }
                    ]
                });
            }
        }
    });

    test('second argument is Literal', function () {
        var foo = 'foo';
        try {
            eval(weave('assert.equal(foo, "bar");'));
            baseAssert.ok(false, 'AssertionError should be thrown');
        } catch (e) {
            baseAssert.equal(e.name, 'AssertionError');
            if (option.modifyMessageOnRethrow) {
                baseAssert.equal(e.message, [
                    '/path/to/some_test.js',
                    'assert.equal(foo, "bar")',
                    '[{"value":"foo","espath":"arguments/0"}]'
                ].join('\n'));
            }
            if (option.saveContextOnRethrow) {
                baseAssert.deepEqual(e.powerAssertContext, {
                    "source":{
                        "content":"assert.equal(foo, \"bar\")",
                        "filepath":"/path/to/some_test.js",
                        "line": 1
                    },
                    "args":[
                        {
                            "value":"foo",
                            "events":[{"value":"foo","espath":"arguments/0"}]
                        }
                    ]
                });
            }
        }
    });
});

}

testWithOption({
    modifyMessageOnRethrow: false,
    saveContextOnRethrow: false
});

testWithOption({
    modifyMessageOnRethrow: true,
    saveContextOnRethrow: false
});

testWithOption({
    modifyMessageOnRethrow: false,
    saveContextOnRethrow: true
});

testWithOption({
    modifyMessageOnRethrow: true,
    saveContextOnRethrow: true
});



test('the case when assertion function call is not listed in patterns (even if methods do)', function () {
    var patterns = [
        'assert.ok(value, [message])',
        'assert.equal(actual, expected, [message])',
        'assert.notEqual(actual, expected, [message])',
        'assert.strictEqual(actual, expected, [message])',
        'assert.notStrictEqual(actual, expected, [message])',
        'assert.deepEqual(actual, expected, [message])',
        'assert.notDeepEqual(actual, expected, [message])'
    ];
    var weave = function (line) {
        return espowerSource(line, '/path/to/some_test.js', { patterns: patterns });
    };
    var assert = empower(baseAssert, fakeFormatter, { patterns: patterns });

    var falsy = 0;
    try {
        eval(weave('assert(falsy);'));
        baseAssert.ok(false, 'AssertionError should be thrown');
    } catch (e) {
        baseAssert.equal(e.name, 'AssertionError');
        baseAssert.equal(e.message, '0 == true', 'should not be empowered');
    }
});


}));
