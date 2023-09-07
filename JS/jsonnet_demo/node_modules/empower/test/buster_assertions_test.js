(function (root, factory) {
    'use strict';
    if (typeof define === 'function' && define.amd) {
        define(['empower', 'espower-source', 'assert', 'buster-assertions'], factory);
    } else if (typeof exports === 'object') {
        factory(require('..'), require('espower-source'), require('assert'), require('buster-assertions'));
    } else {
        factory(root.empower, root.espowerSource, root.assert, root.buster);
    }
}(this, function (
    empower,
    espowerSource,
    baseAssert,
    busterAssertions
) {
    var weave = function (line) {
        var options = {
            destructive: false,
            path: '/path/to/some_test.js',
            patterns: [
                'assert(actual, [message])',
                'assert.isNull(object, [message])',
                'assert.same(actual, expected, [message])',
                'assert.near(actual, expected, delta, [message])'
            ]
        };
        return espowerSource(line, '/path/to/some_test.js', options);
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

    var assert = empower(busterAssertions.assert, fakeFormatter, {
        patterns: [
            'assert(actual, [message])',
            'assert.isNull(object, [message])',
            'assert.same(actual, expected, [message])',
            'assert.near(actual, expected, delta, [message])'
        ]
    });


    test('buster assertion is also an assert function', function () {
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


    suite('buster assertion with one argument', function () {
        test('isNull method', function () {
            var falsy = 0;
            try {
                eval(weave('assert.isNull(falsy);'));
                baseAssert.ok(false, 'AssertionError should be thrown');
            } catch (e) {
                baseAssert.equal(e.name, 'AssertionError');
                baseAssert.equal(e.message, [
                    '[assert.isNull] /path/to/some_test.js',
                    'assert.isNull(falsy)',
                    '[{"value":0,"espath":"arguments/0"}]: Expected 0 to be null'
                ].join('\n'));
            }
        });
    });


    suite('buster assertion method with two arguments', function () {
        test('both Identifier', function () {
            var foo = 'foo', bar = 'bar';
            try {
                eval(weave('assert.same(foo, bar);'));
                baseAssert.ok(false, 'AssertionError should be thrown');
            } catch (e) {
                baseAssert.equal(e.name, 'AssertionError');
                baseAssert.equal(e.message, [
                    '[assert.same] /path/to/some_test.js',
                    'assert.same(foo, bar)',
                    '[{"value":"foo","espath":"arguments/0"},{"value":"bar","espath":"arguments/1"}]: foo expected to be the same object as bar'
                ].join('\n'));
            }
        });

        test('first argument is Literal', function () {
            var bar = 'bar';
            try {
                eval(weave('assert.same("foo", bar);'));
                baseAssert.ok(false, 'AssertionError should be thrown');
            } catch (e) {
                baseAssert.equal(e.name, 'AssertionError');
                baseAssert.equal(e.message, [
                    '[assert.same] /path/to/some_test.js',
                    'assert.same("foo", bar)',
                    '[{"value":"bar","espath":"arguments/1"}]: foo expected to be the same object as bar'
                ].join('\n'));
            }
        });

        test('second argument is Literal', function () {
            var foo = 'foo';
            try {
                eval(weave('assert.same(foo, "bar");'));
                baseAssert.ok(false, 'AssertionError should be thrown');
            } catch (e) {
                baseAssert.equal(e.name, 'AssertionError');
                baseAssert.equal(e.message, [
                    '[assert.same] /path/to/some_test.js',
                    'assert.same(foo, "bar")',
                    '[{"value":"foo","espath":"arguments/0"}]: foo expected to be the same object as bar'
                ].join('\n'));
            }
        });
    });


    suite('buster assertion method with three arguments', function () {
        test('when every argument is Identifier', function () {
            var actualVal = 10.6, expectedVal = 10, delta = 0.5;
            try {
                eval(weave('assert.near(actualVal, expectedVal, delta);'));
                baseAssert.ok(false, 'AssertionError should be thrown');
            } catch (e) {
                baseAssert.equal(e.name, 'AssertionError');
                baseAssert.equal(e.message, [
                    '[assert.near] /path/to/some_test.js',
                    'assert.near(actualVal, expectedVal, delta)',
                    '[{"value":10.6,"espath":"arguments/0"},{"value":10,"espath":"arguments/1"},{"value":0.5,"espath":"arguments/2"}]: Expected 10.6 to be equal to 10 +/- 0.5'
                ].join('\n'));
            }
        });

        test('optional fourth argument', function () {
            var actualVal = 10.6, expectedVal = 10, delta = 0.5, messageStr = 'not in delta';
            try {
                eval(weave('assert.near(actualVal, expectedVal, delta, messageStr);'));
                baseAssert.ok(false, 'AssertionError should be thrown');
            } catch (e) {
                baseAssert.equal(e.name, 'AssertionError');
                baseAssert.equal(e.message, [
                    '[assert.near] not in delta /path/to/some_test.js',
                    'assert.near(actualVal, expectedVal, delta, messageStr)',
                    '[{"value":10.6,"espath":"arguments/0"},{"value":10,"espath":"arguments/1"},{"value":0.5,"espath":"arguments/2"}]: Expected 10.6 to be equal to 10 +/- 0.5'
                ].join('\n'));
            }
        });
    });

}));
