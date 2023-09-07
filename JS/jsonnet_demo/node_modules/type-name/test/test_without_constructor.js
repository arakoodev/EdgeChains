var NonConstructorPerson = {
    constructor: null
};

var typeName = require('..'),
    assert = require('assert'),
    fixtures = {
        'Object object': NonConstructorPerson
    };

describe('typeName of', function () {
    var i, tests = [
        ['Object object', 'Object']
    ];

    for(i = 0; i < tests.length; i += 1) {
        (function(idx){
            var sut = tests[idx][0],
                expected = tests[idx][1],
                input = fixtures[sut];
            it(sut + ' is ' + expected, function () {
                assert.equal(typeName(input), expected);
            });
        })(i);
    }
});
