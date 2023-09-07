var require = {
    paths: {
        empower: "../build/empower",
        "espower-source": "../bower_components/espower-source/build/espower-source",
        assert: "../bower_components/assert/assert",
        mocha: "../bower_components/mocha/mocha",
        requirejs: "../bower_components/requirejs/require",
        "buster-assertions": "../bower_components/buster.js/buster-test"
    },
    shim: {
        assert: {
            exports: "assert"
        },
        "buster-assertions": {
            exports: "buster"
        }
    }
};
