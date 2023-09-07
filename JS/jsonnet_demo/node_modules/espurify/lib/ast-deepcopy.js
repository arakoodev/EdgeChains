/**
 * Copyright (C) 2012 Yusuke Suzuki (twitter: @Constellation) and other contributors.
 * Released under the BSD license.
 * https://github.com/Constellation/esmangle/blob/master/LICENSE.BSD
 */
'use strict';

var isArray = Array.isArray || function isArray (array) {
    return Object.prototype.toString.call(array) === '[object Array]';
};

function deepCopyInternal (obj, result) {
    var key, val;
    for (key in obj) {
        if (key.lastIndexOf('__', 0) === 0) {
            continue;
        }
        if (obj.hasOwnProperty(key)) {
            val = obj[key];
            if (typeof val === 'object' && val !== null) {
                if (val instanceof RegExp) {
                    val = new RegExp(val);
                } else {
                    val = deepCopyInternal(val, isArray(val) ? [] : {});
                }
            }
            result[key] = val;
        }
    }
    return result;
}

function deepCopy (obj) {
    return deepCopyInternal(obj, isArray(obj) ? [] : {});
}

module.exports = deepCopy;
