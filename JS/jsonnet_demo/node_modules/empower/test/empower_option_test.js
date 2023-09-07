(function (root, factory) {
    'use strict';
    if (typeof define === 'function' && define.amd) {
        define(['empower', 'assert'], factory);
    } else if (typeof exports === 'object') {
        factory(require('..'), require('assert'));
    } else {
        factory(root.empower, root.assert);
    }
}(this, function (
    empower,
    assert
) {

    var fakeFormatter = function (context) {
        return [
            context.location.path,
            context.content
        ].join('\n');
    };


suite('empower.defaultOptions()', function () {
    setup (function () {
        this.options = empower.defaultOptions();
    });
    test('destructive: false', function () {
        assert.equal(this.options.destructive, false);
    });
    test('modifyMessageOnRethrow: false', function () {
        assert.equal(this.options.modifyMessageOnRethrow, false);
    });
    test('saveContextOnRethrow: false', function () {
        assert.equal(this.options.saveContextOnRethrow, false);
    });
    test('formatter: undefined', function () {
        assert.deepEqual(typeof this.options.formatter, 'undefined');
    });
    test('patterns: Array', function () {
        assert.deepEqual(this.options.patterns, [
            'assert(value, [message])',
            'assert.ok(value, [message])',
            'assert.equal(actual, expected, [message])',
            'assert.notEqual(actual, expected, [message])',
            'assert.strictEqual(actual, expected, [message])',
            'assert.notStrictEqual(actual, expected, [message])',
            'assert.deepEqual(actual, expected, [message])',
            'assert.notDeepEqual(actual, expected, [message])'
        ]);
    });
});


suite('empower argument preconditions', function () {
    function argumentTest (name, arg, expectedMessage) {
        expectedMessage = expectedMessage || 'empower argument should be a function or object.';
        test(name, function () {
            assert.throws(
                function() {
                    empower(arg, fakeFormatter);
                },
                function(err) {
                    return ((err instanceof TypeError) && (expectedMessage === err.message));
                },
                "unexpected error"
            );
        });
    }
    argumentTest('cannot pass null', null);
    argumentTest('cannot pass undefined', undefined);
    argumentTest('cannot pass number', 3);
    argumentTest('cannot pass string', 'hoge');
});


function sharedTestsForEmpowerFunctionReturnValue () {
    test('has ok method', function () {
        assert.equal(typeof this.empoweredAssert.ok, 'function');
    });
    test('has _capt method', function () {
        assert.equal(typeof this.empoweredAssert._capt, 'function');
    });
    test('has _expr method', function () {
        assert.equal(typeof this.empoweredAssert._expr, 'function');
    });
    test('has equal method', function () {
        assert.equal(typeof this.empoweredAssert.equal, 'function');
    });
    test('has strictEqual method', function () {
        assert.equal(typeof this.empoweredAssert.strictEqual, 'function');
    });
    test('ok method works as assert.ok', function () {
        var empoweredAssert = this.empoweredAssert;
        assert.throws(function () {
            empoweredAssert.ok(false, 'empoweredAssert.ok');
        }, /FakeAssert: assertion failed. empoweredAssert.ok/);
    });
    test('equal method works', function () {
        var empoweredAssert = this.empoweredAssert;
        assert.throws(function () {
            empoweredAssert.equal(1, 'hoge', 'empoweredAssert.equal');
        }, /FakeAssert: assertion failed. empoweredAssert.equal/);
    });
    test('strictEqual method works', function () {
        var empoweredAssert = this.empoweredAssert;
        assert.throws(function () {
            empoweredAssert.strictEqual(1, '1', 'empoweredAssert.strictEqual');
        }, /FakeAssert: assertion failed. empoweredAssert.strictEqual/);
    });
    test('preserve return value if target assertion method returns something', function () {
        var empoweredAssert = this.empoweredAssert,
            ret = empoweredAssert.equal(1, '1');
        empoweredAssert.strictEqual(ret, true);
    });
}


suite('assert object empowerment', function () {
    setup(function () {
        function fail(actual, expected, message, operator) {
            throw new assert.AssertionError({
                message: message,
                actual: actual,
                expected: expected,
                operator: operator
            });
        }
        var assertOk = function (actual, message) {
            if (!actual) {
                fail(actual, true, 'FakeAssert: assertion failed. ' + message, '==');
            }
        };
        var fakeAssertObject = {
            ok: assertOk,
            equal: function (actual, expected, message) {
                if (!(actual == expected)) {
                    fail(actual, expected, 'FakeAssert: assertion failed. ' + message, '==');
                }
                return true;
            },
            strictEqual: function (actual, expected, message) {
                if (!(actual === expected)) {
                    fail(actual, expected, 'FakeAssert: assertion failed. ' + message, '===');
                }
            }
        };
        this.fakeAssertObject = fakeAssertObject;
    });

    suite('destructive: false', function () {
        setup(function () {
            this.options = {
                destructive: false,
                patterns: [
                    'assert.ok(value, [message])',
                    'assert.equal(actual, expected, [message])',
                    'assert.strictEqual(actual, expected, [message])'
                ]
            };
            this.empoweredAssert = empower(this.fakeAssertObject, fakeFormatter, this.options);
        });
        suite('returned assert', function () {
            sharedTestsForEmpowerFunctionReturnValue();
            test('is also an object', function () {
                assert.ok(typeof this.empoweredAssert, 'object');
            });
            test('is not the same instance as target assert object', function () {
                assert.notEqual(this.empoweredAssert, this.fakeAssertObject);
            });
            test('ok method is not refered to target.ok', function () {
                assert.notEqual(this.empoweredAssert.ok, this.fakeAssertObject.ok);
            });
        });
        test('avoid empowering multiple times', function () {
            var empoweredAgain = empower(this.empoweredAssert, fakeFormatter, this.options);
            assert.equal(empoweredAgain, this.empoweredAssert);
        });
    });

    suite('destructive: true', function () {
        setup(function () {
            this.options = {
                destructive: true,
                patterns: [
                    'assert.ok(value, [message])',
                    'assert.equal(actual, expected, [message])',
                    'assert.strictEqual(actual, expected, [message])'
                ]
            };
            this.empoweredAssert = empower(this.fakeAssertObject, fakeFormatter, this.options);
        });
        suite('returned assert', function () {
            sharedTestsForEmpowerFunctionReturnValue();
            test('is also an object', function () {
                assert.ok(typeof this.empoweredAssert, 'object');
            });
            test('is the same instance as target assert object', function () {
                assert.equal(this.empoweredAssert, this.fakeAssertObject);
            });
            test('ok method is refered to target.ok', function () {
                assert.equal(this.empoweredAssert.ok, this.fakeAssertObject.ok);
            });
        });
        test('avoid empowering multiple times', function () {
            var empoweredAgain = empower(this.fakeAssertObject, fakeFormatter, this.options);
            assert.equal(empoweredAgain, this.fakeAssertObject);
        });
    });
});


suite('assert function empowerment', function () {
    setup(function () {
        function fail(actual, expected, message, operator) {
            throw new assert.AssertionError({
                message: message,
                actual: actual,
                expected: expected,
                operator: operator
            });
        }
        var assertOk = function (actual, message) {
            if (!actual) {
                fail(actual, true, 'FakeAssert: assertion failed. ' + message, '==');
            }
            return true;
        };
        assertOk.ok = assertOk;
        assertOk.equal = function (actual, expected, message) {
            if (!(actual == expected)) {
                fail(actual, expected, 'FakeAssert: assertion failed. ' + message, '==');
            }
            return true;
        };
        assertOk.strictEqual = function (actual, expected, message) {
            if (!(actual === expected)) {
                fail(actual, expected, 'FakeAssert: assertion failed. ' + message, '===');
            }
        };
        this.fakeAssertFunction = assertOk;
    });

    suite('destructive: false', function () {
        setup(function () {
            this.options = {
                destructive: false,
                patterns: [
                    'assert(value, [message])',
                    'assert.ok(value, [message])',
                    'assert.equal(actual, expected, [message])',
                    'assert.strictEqual(actual, expected, [message])'
                ]
            };
            this.empoweredAssert = empower(this.fakeAssertFunction, fakeFormatter, this.options);
        });
        suite('returned assert', function () {
            sharedTestsForEmpowerFunctionReturnValue();
            test('works as assert function', function () {
                var empoweredAssert = this.empoweredAssert;
                assert.throws(function () {
                    empoweredAssert(false, 'empoweredAssert');
                }, /FakeAssert: assertion failed. empoweredAssert/);
            });
            test('is also a function', function () {
                assert.ok(typeof this.empoweredAssert, 'function');
            });
            test('is not the same instance as target assert function', function () {
                assert.notEqual(this.empoweredAssert, this.fakeAssertFunction);
            });
            test('ok method is not refered to target.ok', function () {
                assert.notEqual(this.empoweredAssert.ok, this.fakeAssertFunction.ok);
            });
            test('ok method is not refered to target assert function', function () {
                assert.notEqual(this.empoweredAssert.ok, this.fakeAssertFunction.ok);
            });
            test('preserve return value if target assertion function itself returns something', function () {
                var empoweredAssert = this.empoweredAssert,
                    ret = empoweredAssert('truthy');
                empoweredAssert.strictEqual(ret, true);
            });
        });
        test('avoid empowering multiple times', function () {
            var empoweredAgain = empower(this.empoweredAssert, fakeFormatter, this.options);
            assert.equal(empoweredAgain, this.empoweredAssert);
        });
    });

    test('does not support destructive:true', function () {
        var func = this.fakeAssertFunction;
        assert.throws(function () {
            empower(func, fakeFormatter, {destructive: true});
        }, 'cannot use destructive:true to function\.');
    });
});

}));
