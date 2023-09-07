var minimatch = require('minimatch'),
    path = require('path'),
    assert = require('assert');

describe('minimatch learning', function () {

    describe ('simplest match', function () {
        it('extension', function () {
            assert(minimatch('bar.js', '*.js'));
        });
        it('path', function () {
            assert(minimatch('/foo/bar/baz.js', '/foo/bar/*.js'));
        });
    });

    it('does not normailze', function () {
        assert(! minimatch('/foo/bar/baz.js', '/foo/hoge/../bar/*.js'));
    });

    describe('cwd and forward slash', function () {
        beforeEach(function () {
            this.filepath = path.join(process.cwd(), 'test', 'foo', 'hoge.js');
        });
        it('starts with process.cwd() and not with forward slash', function () {
            assert(! minimatch(this.filepath, process.cwd() + 'test/**/*.js'));
        });
        it('starts with process.cwd() then forward slash', function () {
            assert(minimatch(this.filepath, process.cwd() + '/' + 'test/**/*.js'));
        });
        it('starts with wildcard', function () {
            assert(minimatch(this.filepath, '**/test/**/*.js'));
        });
    });
});
