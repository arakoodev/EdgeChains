(function (root, factory) {
    'use strict';
    if (typeof define === 'function' && define.amd) {
        define(['power-assert-formatter', 'empower', 'espower-source', 'assert'], factory);
    } else if (typeof exports === 'object') {
        factory(require('..'), require('empower'), require('espower-source'), require('assert'));
    } else {
        factory(root.powerAssertFormatter, root.empower, root.espowerSource, root.assert);
    }
}(this, function (
    createFormatter,
    empower,
    espowerSource,
    baseAssert
) {
    function weave (line) {
        return espowerSource(line, '/path/to/some_test.js');
    }

suite('lineSeparator option', function () {
    function lineSeparatorTest (name, option, expectedSeparator) {
        var assert = empower(baseAssert, createFormatter(option));
        test(name, function () {
            var falsyNum = 0;
            try {
                eval(weave('assert(falsyNum);'));
            } catch (e) {
                baseAssert.equal(e.name, 'AssertionError');
                baseAssert.equal(e.message, [
                    '# /path/to/some_test.js:1',
                    '',
                    'assert(falsyNum)',
                    '       |        ',
                    '       0        ',
                    ''
                ].join(expectedSeparator));
            }
        });
    }
    lineSeparatorTest('default is LF', {}, '\n');
    lineSeparatorTest('LF', {lineSeparator: '\n'}, '\n');
    lineSeparatorTest('CR', {lineSeparator: '\r'}, '\r');
    lineSeparatorTest('CRLF', {lineSeparator: '\r\n'}, '\r\n');
});

}));
