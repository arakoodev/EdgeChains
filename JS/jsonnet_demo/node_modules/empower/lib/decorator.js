'use strict';

var escallmatch = require('escallmatch'),
    extend = require('xtend/mutable'),
    capturable = require('./capturable'),
    decorate = require('./decorate'),
    slice = Array.prototype.slice,
    isPhantom = typeof window !== 'undefined' && typeof window.callPhantom === 'function';


function Decorator (receiver, formatter, config) {
    this.receiver = receiver;
    this.formatter = formatter;
    this.config = config;
    this.matchers = config.patterns.map(escallmatch);
    this.eagerEvaluation = !(config.modifyMessageOnRethrow || config.saveContextOnRethrow);
}

Decorator.prototype.enhancement = function () {
    var that = this;
    var container = this.container();
    this.matchers.filter(methodCall).forEach(function (matcher) {
        var methodName = detectMethodName(matcher.calleeAst());
        if (typeof that.receiver[methodName] === 'function') {
            var callSpec = {
                thisObj: that.receiver,
                func: that.receiver[methodName],
                numArgsToCapture: numberOfArgumentsToCapture(matcher)
            };
            container[methodName] = decorate(callSpec, that);
        }
    });
    extend(container, capturable());
    return container;
};

Decorator.prototype.container = function () {
    var basement = {};
    if (typeof this.receiver === 'function') {
        var candidates = this.matchers.filter(functionCall);
        if (candidates.length === 1) {
            var callSpec = {
                thisObj: null,
                func: this.receiver,
                numArgsToCapture: numberOfArgumentsToCapture(candidates[0])
            };
            basement = decorate(callSpec, this);
        }
    }
    return basement;
};

Decorator.prototype.concreteAssert = function (invocation, context) {
    var func = invocation.func,
        thisObj = invocation.thisObj,
        args = invocation.values,
        message = invocation.message;
    if (this.eagerEvaluation) {
        var poweredMessage = this.buildPowerAssertText(message, context);
        return func.apply(thisObj, args.concat(poweredMessage));
    }
    try {
        return func.apply(thisObj, args.concat(message));
    } catch (e) {
        throw this.errorToRethrow(e, message, context);
    }
};

Decorator.prototype.errorToRethrow = function (e, originalMessage, context) {
    var f;
    if (e.name !== 'AssertionError') {
        return e;
    }
    if (typeof this.receiver.AssertionError !== 'function') {
        return e;
    }
    if (isPhantom) {
        f = new this.receiver.AssertionError({
            actual: e.actual,
            expected: e.expected,
            operator: e.operator,
            message: e.message
        });
    } else {
        f = e;
    }
    if (this.config.modifyMessageOnRethrow) {
        f.message = this.buildPowerAssertText(originalMessage, context);
        if (typeof e.generatedMessage !== 'undefined') {
            f.generatedMessage = false;
        }
    }
    if (this.config.saveContextOnRethrow) {
        f.powerAssertContext = context;
    }
    return f;
};

Decorator.prototype.buildPowerAssertText = function (message, context) {
    var powerAssertText = this.formatter(context);
    return message ? message + ' ' + powerAssertText : powerAssertText;
};


function numberOfArgumentsToCapture (matcher) {
    var argSpecs = matcher.argumentSignatures(),
        len = argSpecs.length,
        lastArg;
    if (0 < len) {
        lastArg = argSpecs[len - 1];
        if (lastArg.name === 'message' && lastArg.kind === 'optional') {
            len -= 1;
        }
    }
    return len;
}


function detectMethodName (node) {
    if (node.type === 'MemberExpression') {
        return node.property.name;
    }
    return null;
}


function functionCall (matcher) {
    return matcher.calleeAst().type === 'Identifier';
}


function methodCall (matcher) {
    return matcher.calleeAst().type === 'MemberExpression';
}


module.exports = Decorator;
