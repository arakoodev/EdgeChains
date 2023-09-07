var gulp = require('gulp'),
    gutil = require('gulp-util'),
    jshint = require('gulp-jshint'),
    stylish = require('jshint-stylish'),
    mocha = require('gulp-mocha'),
    mochaPhantomJS = require('gulp-mocha-phantomjs'),
    webserver = require('gulp-webserver'),
    del = require('del'),
    path = require('path'),
    glob = require("glob"),
    source = require('vinyl-source-stream'),
    browserify = require('browserify'),
    derequire = require('gulp-derequire'),
    config = {
        jshint: {
            src: './index.js'
        },
        bundle: {
            standalone: 'espowerSource',
            srcFile: './index.js',
            destDir: './build',
            destName: 'espower-source.js'
        },
        test_bundle: {
            srcFile: './test/*test.js',
            destDir: './build',
            destName: 'test.js'
        },
        test: {
            base: './test/',
            pattern: '**/*test.js',
            browser: 'test/test-browser.html'
        }
    };

function runMochaSimply() {
    return gulp
        .src(config.test.base + config.test.pattern, {read: false})
        .pipe(mocha({
            ui: 'bdd',
            reporter: 'dot'
        }))
        .on('error', gutil.log);
}

gulp.task('webserver', function() {
    gulp.src(__dirname)
        .pipe(webserver({
            port: 9001,
            directoryListing: true
        }));
});

gulp.task('watch', function () {
    gulp.watch(['index.js', 'test/**/*.js'], runMochaSimply);
    runMochaSimply();
});

gulp.task('clean_bundle', function (done) {
    del([path.join(config.bundle.destDir, config.bundle.destName)], done);
});

gulp.task('clean_test_bundle', function (done) {
    del([path.join(config.test_bundle.destDir, config.test_bundle.destName)], done);
});

gulp.task('bundle', ['clean_bundle'], function() {
    var bundleStream = browserify({entries: config.bundle.srcFile, standalone: config.bundle.standalone}).bundle();
    return bundleStream
        .pipe(source(config.bundle.destName))
        .pipe(derequire())
        .pipe(gulp.dest(config.bundle.destDir));
});

gulp.task('test_bundle', ['clean_test_bundle'], function() {
    var files = glob.sync(config.test_bundle.srcFile);
    var bundleStream = browserify({entries: files}).transform('brfs').bundle();
    return bundleStream
        .pipe(source(config.test_bundle.destName))
        .pipe(gulp.dest(config.test_bundle.destDir));
});

gulp.task('lint', function() {
    return gulp.src(config.jshint.src)
        .pipe(jshint())
        .pipe(jshint.reporter(stylish));
});

gulp.task('unit', function () {
    return runMochaSimply();
});

gulp.task('test_browser', ['bundle', 'test_bundle'], function () {
    return gulp
        .src(config.test.browser)
        .pipe(mochaPhantomJS({reporter: 'dot'}));
});

gulp.task('clean', ['clean_bundle', 'clean_test_bundle']);

gulp.task('test', ['unit','test_browser']);
