'use strict';

var slice = Array.prototype.slice;

function decorate (callSpec, decorator) {
    var func = callSpec.func,
        thisObj = callSpec.thisObj,
        numNonMessageArgs = callSpec.numArgsToCapture;

    return function () {
        var context, message, args = slice.apply(arguments);

        if (args.every(isNotCaptured)) {
            return func.apply(thisObj, args);
        }

        var values = args.slice(0, numNonMessageArgs).map(function (arg) {
            if (isNotCaptured(arg)) {
                return arg;
            }
            if (!context) {
                context = {
                    source: arg.source,
                    args: []
                };
            }
            context.args.push({
                value: arg.powerAssertContext.value,
                events: arg.powerAssertContext.events
            });
            return arg.powerAssertContext.value;
        });

        if (numNonMessageArgs === (args.length - 1)) {
            message = args[args.length - 1];
        }

        var invocation = {
            thisObj: thisObj,
            func: func,
            values: values,
            message: message
        };
        return decorator.concreteAssert(invocation, context);
    };
}

function isNotCaptured (value) {
    return !isCaptured(value);
}

function isCaptured (value) {
    return (typeof value === 'object') &&
        (value !== null) &&
        (typeof value.powerAssertContext !== 'undefined');
}

module.exports = decorate;
