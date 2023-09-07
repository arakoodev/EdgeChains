var require = {
    paths: {
        espower: '../build/espower',
        assert: '../bower_components/assert/assert',
        escodegen: '../bower_components/escodegen/escodegen.browser',
        esprima: '../bower_components/esprima/esprima',
        estraverse: '../bower_components/estraverse/estraverse',
        mocha: '../bower_components/mocha/mocha',
        requirejs: '../bower_components/requirejs/require'
    },
    shim: {
        assert: {
            exports: 'assert'
        },
        escodegen: {
            exports: 'escodegen'
        }
    }
};
