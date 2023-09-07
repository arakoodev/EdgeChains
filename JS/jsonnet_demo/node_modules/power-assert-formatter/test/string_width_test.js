(function (root, factory) {
    'use strict';
    if (typeof define === 'function' && define.amd) {
        define(['power-assert-formatter', 'assert'], factory);
    } else if (typeof exports === 'object') {
        factory(require('..'), require('assert'));
    } else {
        factory(root.powerAssertFormatter, root.assert);
    }
}(this, function (
    formatter,
    assert
) {
    var stringWidth = formatter.stringWidth;

    suite('string width', function () {
        [
            ['abcde',  5],
            ['あいうえお',  10],
            ['ｱｲｳｴｵ',       5]
        ].forEach(function(col, idx) {
            var input = col[0], expected = col[1];
            test(idx + ': ' + input, function () {
                assert.equal(stringWidth(input), expected);
            });
        });

        suite('unicode normalization', function () {
            test('composition', function () {
                var str = 'が';
                assert.equal(str.length, 1);
                assert.equal(stringWidth(str), 2);
            });
            test('decomposition', function () {
                var str = 'か\u3099';
                assert.equal(str.length, 2);
                assert.equal(stringWidth(str), 4);
            });
        });

        test('surrogate pair', function () {
            var strWithSurrogatePair = "𠮷野家で𩸽";
            assert.equal(strWithSurrogatePair.length, 7);
            assert.equal(stringWidth(strWithSurrogatePair), 10);
        });
    });
}));
