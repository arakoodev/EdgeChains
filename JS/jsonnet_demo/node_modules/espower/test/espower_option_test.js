(function (root, factory) {
    'use strict';
    if (typeof define === 'function' && define.amd) {
        define(['espower', 'esprima', 'escodegen', 'estraverse', 'assert'], factory);
    } else if (typeof exports === 'object') {
        factory(require('..'), require('esprima'), require('escodegen'), require('estraverse'), require('assert'));
    } else {
        factory(root.espower, root.esprima, root.escodegen, root.estraverse, root.assert);
    }
}(this, function (
    espower,
    esprima,
    escodegen,
    estraverse,
    assert
) {

// see: https://github.com/Constellation/escodegen/issues/115
if (typeof define === 'function' && define.amd) {
    escodegen = window.escodegen;
}


function instrument (jsCode, options) {
    var jsAST = esprima.parse(jsCode, {tolerant: true, loc: true, tokens: true, raw: true});
    var espoweredAST = espower(jsAST, options);
    var instrumentedCode = escodegen.generate(espoweredAST, {format: {compact: true}});
    return instrumentedCode;
}


describe('espower.defaultOptions()', function () {
    beforeEach(function () {
        this.options = espower.defaultOptions();
    });
    it('destructive: false', function () {
        assert.equal(this.options.destructive, false);
    });
});


describe('instrumentation tests for options', function () {

    describe('destructive option', function () {
        function destructiveOptionTest (testName, option, callback) {
            it(testName, function () {
                var tree = esprima.parse('assert(falsyStr);', {tolerant: true, loc: true, range: true, tokens: true, raw: true}),
                    saved = espower.deepCopy(tree),
                    result = espower(tree, option);
                callback(assert, saved, tree, result);
            });
        }
        destructiveOptionTest('default is false', {source: 'assert(falsyStr);'}, function (assert, before, tree, after) {
            assert.deepEqual(tree, before);
            assert.notDeepEqual(after, before);
            assert.notDeepEqual(after, tree);
        });
        destructiveOptionTest('destructive: false', {source: 'assert(falsyStr);', destructive: false}, function (assert, before, tree, after) {
            assert.deepEqual(tree, before);
            assert.notDeepEqual(after, before);
            assert.notDeepEqual(after, tree);
        });
        destructiveOptionTest('destructive: true', {source: 'assert(falsyStr);', destructive: true}, function (assert, before, tree, after) {
            assert.notDeepEqual(tree, before);
            assert.notDeepEqual(after, before);
            assert.deepEqual(after, tree);
        });
    });


    describe('patterns option.', function () {
        it('matches function call', function () {
            var instrumentedCode = instrument('refute(falsyStr);', {
                source: 'refute(falsyStr);',
                patterns: [
                    'refute(value)'
                ]
            });
            assert.equal(instrumentedCode, "refute(refute._expr(refute._capt(falsyStr,'arguments/0'),{content:'refute(falsyStr)',line:1}));");
        });

        it('matches method call', function () {
            var instrumentedCode = instrument('refute.equal(foo, bar);', {
                source: 'refute.equal(foo, bar);',
                patterns: [
                    'refute.equal(actual, expected)'
                ]
            });
            assert.equal(instrumentedCode, "refute.equal(refute._expr(refute._capt(foo,'arguments/0'),{content:'refute.equal(foo, bar)',line:1}),refute._expr(refute._capt(bar,'arguments/1'),{content:'refute.equal(foo, bar)',line:1}));");
        });

        it('deep callee chain', function () {
            var instrumentedCode = instrument('browser.assert.element(foo);', {
                source: 'browser.assert.element(foo);',
                patterns: [
                    'browser.assert.element(selection, [message])'
                ]
            });
            assert.equal(instrumentedCode, "browser.assert.element(browser.assert._expr(browser.assert._capt(foo,'arguments/0'),{content:'browser.assert.element(foo)',line:1}));");
        });
    });


    describe('source option and path option.', function () {
        it('path: null', function () {
            var instrumentedCode = instrument('assert(falsyStr);', {source: 'assert(falsyStr);'});
            assert.equal(instrumentedCode, "assert(assert._expr(assert._capt(falsyStr,'arguments/0'),{content:'assert(falsyStr)',line:1}));");
        });
        it('with source and path', function () {
            var instrumentedCode = instrument('assert(falsyStr);', {source: 'assert(falsyStr);', path: '/path/to/baz_test.js'});
            assert.equal(instrumentedCode, "assert(assert._expr(assert._capt(falsyStr,'arguments/0'),{content:'assert(falsyStr)',filepath:'/path/to/baz_test.js',line:1}));");
        });
    });
});


describe('option prerequisites', function () {
    beforeEach(function () {
        this.tree = esprima.parse('assert(falsyStr);', {tolerant: true, loc: true, range: true, tokens: true, raw: true});
    });
    function optionPrerequisitesTest (name, options, expected) {
        it(name, function () {
            try {
                espower(this.tree, options);
                assert.ok(false, 'Error should be thrown');
            } catch (e) {
                assert.equal(e.message, expected);
                assert.equal(e.name, 'Error');
            }
        });
    }

    optionPrerequisitesTest('destructive option shoud be a boolean',
                            {source: 'assert(falsyStr);', destructive: 1},
                            'options.destructive should be a boolean value.');

    optionPrerequisitesTest('patterns option should be an array',
                            {source: 'assert(falsyStr);', patterns: 'hoge'},
                            'options.patterns should be an array.');
});


describe('AST prerequisites. Error should be thrown if location is missing.', function () {
    beforeEach(function () {
        this.jsCode = 'assert(falsyStr);';
        this.tree = esprima.parse(this.jsCode, {tolerant: true, loc: false, tokens: true, raw: true});
    });
    it('error message when path option is not specified', function () {
        try {
            espower(this.tree, {destructive: false, source: this.jsCode});
            assert.ok(false, 'Error should be thrown');
        } catch (e) {
            assert.equal(e.name, 'Error');
            assert.equal(e.message, 'JavaScript AST should contain location information.');
        }
    });
    it('error message when path option is specified', function () {
        try {
            espower(this.tree, {destructive: false, source: this.jsCode, path: '/path/to/baz_test.js'});
            assert.ok(false, 'Error should be thrown');
        } catch (e) {
            assert.equal(e.name, 'Error');
            assert.equal(e.message, 'JavaScript AST should contain location information. path: /path/to/baz_test.js');
        }
    });
});


describe('location information', function () {
    it('preserve location of instrumented nodes.', function () {
        var jsCode = 'assert((three * (seven * ten)) === three);',
            tree = esprima.parse(jsCode, {tolerant: true, loc: true, range: true, tokens: true, raw: true}),
            saved = espower.deepCopy(tree),
            result = espower(tree, {destructive: false, source: jsCode, path: '/path/to/baz_test.js'});
        estraverse.traverse(result, function (node) {
            if (typeof node.type === 'undefined') return;
            assert.ok(node.loc !== 'undefined', 'type: ' + node.type);
            assert.ok(typeof node.range !== 'undefined', 'type: ' + node.type);
        });
    });
});


describe('lineSeparator', function () {
    var lineDetected = "var falsyStr='';assert.ok(assert._expr(assert._capt(falsyStr,'arguments/0'),{content:'assert.ok(falsyStr)',line:3}));";
     function lineSeparatorTest (name, lineSeparatorInCode, options, expected) {
        it(name, function () {
            var sourceLines = [
                'var falsyStr = "";',
                '// comment line',
                'assert.ok(falsyStr);'
            ].join(lineSeparatorInCode);
            options.source = sourceLines;
            assert.equal(instrument(sourceLines, options), expected);
        });
    }
    context('code: LF', function () {
        function when (name, opt, expected) {
            lineSeparatorTest(name, '\n', opt, expected);
        }
        when('option: default', {}, lineDetected);
    });
    context('code: CR', function () {
        function when (name, opt, expected) {
            lineSeparatorTest(name, '\r', opt, expected);
        }
        when('option: default', {}, lineDetected);
    });
    context('code: CRLF', function () {
        function when (name, opt, expected) {
            lineSeparatorTest(name, '\r\n', opt, expected);
        }
        when('option: default', {}, lineDetected);
    });
});


}));
