(function (root, factory) {
    'use strict';
    if (typeof define === 'function' && define.amd) {
        define(['stringifier', 'type-name', 'assert'], factory);
    } else if (typeof exports === 'object') {
        factory(require('..'), require('type-name'), require('assert'));
    } else {
        factory(root.stringifier, root.typeName, root.assert);
    }
}(this, function (
    stringifier,
    typeName,
    assert
) {

var stringify = stringifier.stringify,
    s = stringifier.strategies;

describe('strategies', function () {
    function Student (name, age, gender) {
        this.name = name;
        this.age = age;
        this.gender = gender;
    }

    var AnonStudent = function(name, age, gender) {
        this.name = name;
        this.age = age;
        this.gender = gender;
    };

    beforeEach(function () {
        this.student = new Student('tom', 10, 'M');
        this.anonymous = new AnonStudent('mary', 9, 'F');
        this.longNameStudent = new Student('the_long_name_man', 18, 'M');
    });

    it('always', function () {
        var handlers = {
            'Student': s.always('BOOM')
        };
        assert.equal(stringify(this.student, null, handlers), 'BOOM');
    });

    it('prune', function () {
        var handlers = {
            'Student': s.prune()
        };
        assert.equal(stringify(this.student, null, handlers), '#Student#');
    });

    it('json', function () {
        var handlers = {
            'Student': s.json()
        };
        assert.equal(stringify(this.student, null, handlers), '{"name":"tom","age":10,"gender":"M"}');
    });

    it('toStr', function () {
        var handlers = {
            'Student': s.toStr()
        };
        assert.equal(stringify(this.student, null, handlers), '[object Object]');
    });

    it('newLike', function () {
        var handlers = {
            'Student': s.newLike()
        };
        assert.equal(stringify(this.student, null, handlers), 'new Student({"name":"tom","age":10,"gender":"M"})');
    });

    it('object', function () {
        var handlers = {
            'Student': s.object()
        };
        assert.equal(stringify(this.student, null, handlers), 'Student{name:"tom",age:10,gender:"M"}');
    });

    it('anonymous constructor object', function () {
        var handlers = {
            'Student': s.object(),
            '': s.object()
        };
        assert.equal(stringify(this.anonymous, null, handlers), '@Anonymous{name:"mary",age:9,gender:"F"}');
    });

    it('anonymous constructor alternate name', function () {
        var handlers = {
            'Student': s.object(),
            '': s.object()
        };
        assert.equal(stringify(this.anonymous, {anonymous: 'Anon'}, handlers), 'Anon{name:"mary",age:9,gender:"F"}');
    });

    it('number and array', function () {
        var handlers = {
            'Array': s.array(),
            'number': s.number()
        };
        assert.equal(stringify([NaN, 0, Infinity, -0, -Infinity], null, handlers), '[NaN,0,Infinity,0,-Infinity]');
    });

    it('whitelist by property name', function () {
        var handlers = {
            'Student': s.object(function (kvp) {
                return ['name', 'age'].indexOf(kvp.key) !== -1;
            })
        };
        assert.equal(stringify(this.student, null, handlers), 'Student{name:"tom",age:10}');
    });

    it('blacklist by property name', function () {
        var handlers = {
            'Student': s.object(function (kvp) {
                return ['age', 'gender'].indexOf(kvp.key) === -1;
            })
        };
        assert.equal(stringify(this.student, null, handlers), 'Student{name:"tom"}');
    });

    it('whitelist by property value', function () {
        var handlers = {
            'Student': s.object(function (kvp) {
                return typeName(kvp.value) === 'string';
            })
        };
        assert.equal(stringify(this.student, null, handlers), 'Student{name:"tom",gender:"M"}');
    });

    it('blacklist by property value', function () {
        var handlers = {
            'Student': s.object(function (kvp) {
                return kvp.value !== 'M';
            })
        };
        assert.equal(stringify(this.student, null, handlers), 'Student{name:"tom",age:10}');
    });

    it('array filtering by value', function () {
        var handlers = {
            'Array': s.array(function (kvp) {
                return /^b.*$/.test(kvp.value);
            })
        };
        assert.equal(stringify(['foo', 'bar', 'baz'], null, handlers), '["bar","baz"]');
    });

    it('array filtering by index', function () {
        var handlers = {
            'Array': s.array(function (kvp) {
                return typeName(kvp.key) === 'number' && kvp.key % 2 === 0;
            })
        };
        assert.equal(stringify(['foo', 'bar', 'baz'], null, handlers), '["foo","baz"]');
    });

    it('per-property strategy customization', function () {
        var handlers = {
            'Student': s.object(function (kvp) {
                if (kvp.key === 'age') {
                    return s.always('*secret*');
                }
                return true;
            })
        };
        assert.equal(stringify(this.student, null, handlers), 'Student{name:"tom",age:*secret*,gender:"M"}');
    });

    it('property whitelist and reordering', function () {
        var handlers = {
            'Student': s.object(null, ['gender', 'age'])
        };
        assert.equal(stringify(this.student, null, handlers), 'Student{gender:"M",age:10}');
    });

    it('per-property truncate simply', function () {
        var handlers = {
            'Student': s.object(function (kvp) {
                if (kvp.key === 'name') {
                    return 3;
                }
                return true;
            })
        };
        assert.equal(stringify(this.longNameStudent, null, handlers), 'Student{name:"th..(snip),age:18,gender:"M"}');
    });

    it('do not truncate if string length is short enough', function () {
        var handlers = {
            'Student': s.object(function (kvp) {
                if (kvp.key === 'name') {
                    return 3;
                }
                return true;
            })
        };
        assert.equal(stringify(this.student, null, handlers), 'Student{name:"tom",age:10,gender:"M"}');
    });

    it('per-property truncate bare handler', function () {
        var handlers = {
            'Student': s.object(function (kvp) {
                if (kvp.key === 'name') {
                    return s.flow.compose(s.filters.truncate(3), s.json());
                }
                return true;
            })
        };
        assert.equal(stringify(this.longNameStudent, null, handlers), 'Student{name:"th..(snip),age:18,gender:"M"}');
    });


    it('type detection override', function () {
        var options = {
            typeFun: function (val) {
                if (typeName(val) === '' &&
                    typeName(val.name) === 'string' &&
                    typeName(val.age) === 'number' &&
                    typeName(val.gender) === 'string'
                   ) {
                       return 'Student';
                   } else {
                       return typeName(val);
                   }
            }
        };
        var handlers = {
            'Student': s.object()
        };
        assert.equal(stringify(this.anonymous, options, handlers), 'Student{name:"mary",age:9,gender:"F"}');
    });

});

}));
