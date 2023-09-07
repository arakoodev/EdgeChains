/**
 * espurify - Clone new AST without extra properties
 * 
 * https://github.com/twada/espurify
 *
 * Copyright (c) 2014 Takuto Wada
 * Licensed under the MIT license.
 *   http://twada.mit-license.org/
 */
'use strict';

var traverse = require('traverse'),
    deepCopy = require('./lib/ast-deepcopy'),
    astProps = require('./lib/ast-properties'),
    hasOwn = Object.prototype.hasOwnProperty;

function espurify (node) {
    var result = deepCopy(node);
    traverse(result).forEach(function (x) {
        if (this.parent &&
            this.parent.node &&
            this.parent.node.type &&
            isSupportedNodeType(this.parent.node.type) &&
            !isSupportedKey(this.parent.node.type, this.key))
        {
            this.remove(true);
        }
    });
    return result;
}

function isSupportedNodeType (type) {
    return hasOwn.call(astProps, type);
}

function isSupportedKey (type, key) {
    return astProps[type].indexOf(key) !== -1;
}

module.exports = espurify;
