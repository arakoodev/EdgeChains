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
    baseAssert
) {

function fakeFormatter (context) {
    throw new Error('formatter should not be called');
}


function testWithOption (option) {
    var assert = empower(baseAssert, fakeFormatter, option);


test(JSON.stringify(option) + ' argument is null Literal.', function () {
    var foo = 'foo';
    try {
        eval('assert.equal(foo, null);');
        assert.ok(false, 'AssertionError should be thrown');
    } catch (e) {
        baseAssert.equal(e.name, 'AssertionError');
        baseAssert.equal(e.message, '"foo" == null');
        baseAssert(e.powerAssertContext === undefined);
    }
});


test(JSON.stringify(option) + ' empowered function also acts like an assert function', function () {
    var falsy = 0;
    try {
        eval('assert(falsy);');
        assert.ok(false, 'AssertionError should be thrown');
    } catch (e) {
        baseAssert.equal(e.name, 'AssertionError');
        baseAssert.equal(e.message, '0 == true');
        baseAssert(e.powerAssertContext === undefined);
    }
});


suite(JSON.stringify(option) + ' assertion method with one argument', function () {
    test('Identifier', function () {
        var falsy = 0;
        try {
            eval('assert.ok(falsy);');
            assert.ok(false, 'AssertionError should be thrown');
        } catch (e) {
            baseAssert.equal(e.name, 'AssertionError');
            baseAssert.equal(e.message, '0 == true');
            baseAssert(e.powerAssertContext === undefined);
        }
    });
});


suite(JSON.stringify(option) + ' assertion method with two arguments', function () {
    test('both Identifier', function () {
        var foo = 'foo', bar = 'bar';
        try {
            eval('assert.equal(foo, bar);');
            assert.ok(false, 'AssertionError should be thrown');
        } catch (e) {
            baseAssert.equal(e.name, 'AssertionError');
            baseAssert.equal(e.message, '"foo" == "bar"');
            baseAssert(e.powerAssertContext === undefined);
        }
    });

    test('first argument is Literal', function () {
        var bar = 'bar';
        try {
            eval('assert.equal("foo", bar);');
            assert.ok(false, 'AssertionError should be thrown');
        } catch (e) {
            baseAssert.equal(e.name, 'AssertionError');
            baseAssert.equal(e.message, '"foo" == "bar"');
            baseAssert(e.powerAssertContext === undefined);
        }
    });

    test('second argument is Literal', function () {
        var foo = 'foo';
        try {
            eval('assert.equal(foo, "bar");');
            assert.ok(false, 'AssertionError should be thrown');
        } catch (e) {
            baseAssert.equal(e.name, 'AssertionError');
            baseAssert.equal(e.message, '"foo" == "bar"');
            baseAssert(e.powerAssertContext === undefined);
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

}));
