/**
 * empower - Power Assert feature enhancer for assert function/object.
 *
 * https://github.com/twada/empower
 *
 * Copyright (c) 2013-2014 Takuto Wada
 * Licensed under the MIT license.
 *   https://github.com/twada/empower/blob/master/MIT-LICENSE.txt
 */
var defaultOptions = require('./lib/default-options'),
    Decorator = require('./lib/decorator'),
    slice = Array.prototype.slice,
    extend = require('xtend/mutable');

/**
 * Enhance Power Assert feature to assert function/object.
 * @param assert target assert function or object to enhance
 * @param formatter power assert format function
 * @param options enhancement options
 * @return enhanced assert function/object
 */
function empower (assert, formatter, options) {
    var typeOfAssert = (typeof assert),
        config;
    if ((typeOfAssert !== 'object' && typeOfAssert !== 'function') || assert === null) {
        throw new TypeError('empower argument should be a function or object.');
    }
    if (isEmpowered(assert)) {
        return assert;
    }
    config = extend(defaultOptions(), options);
    switch (typeOfAssert) {
    case 'function':
        return empowerAssertFunction(assert, formatter, config);
    case 'object':
        return empowerAssertObject(assert, formatter, config);
    default:
        throw new Error('Cannot be here');
    }
}

function empowerAssertObject (assertObject, formatter, config) {
    var target = config.destructive ? assertObject : Object.create(assertObject);
    var decorator = new Decorator(target, formatter, config);
    return extend(target, decorator.enhancement());
}

function empowerAssertFunction (assertFunction, formatter, config) {
    if (config.destructive) {
        throw new Error('cannot use destructive:true to function.');
    }
    var decorator = new Decorator(assertFunction, formatter, config);
    var enhancement = decorator.enhancement();
    var powerAssert;
    if (typeof enhancement === 'function') {
        powerAssert = function powerAssert () {
            return enhancement.apply(null, slice.apply(arguments));
        };
    } else {
        powerAssert = function powerAssert () {
            return assertFunction.apply(null, slice.apply(arguments));
        };
    }
    extend(powerAssert, assertFunction);
    return extend(powerAssert, enhancement);
}

function isEmpowered (assertObjectOrFunction) {
    return (typeof assertObjectOrFunction._capt === 'function') && (typeof assertObjectOrFunction._expr === 'function');
}

empower.defaultOptions = defaultOptions;
module.exports = empower;
