'use strict';

var estraverse = require('estraverse'),
    esprima = require('esprima'),
    EsNode = require('./esnode');

function traverseContext (context, handlers) {
    context.args.forEach(function (arg) {
        onEachEsNode(arg, context.source.content, function (esNode) {
            handlers.forEach(function (handler) {
                handler.onEachEsNode(esNode);
            });
        });
    });
}

function onEachEsNode(arg, jsCode, callback) {
    var jsAST = esprima.parse(jsCode, {tolerant: true, loc: true, tokens: true, raw: true}),
        espathToValue = arg.events.reduce(function (accum, ev) {
            accum[ev.espath] = ev.value;
            return accum;
        }, {}),
        nodeStack = [];
    estraverse.traverse(extractExpressionFrom(jsAST), {
        enter: function (currentNode, parentNode) {
            var esNode = new EsNode(this.path(), currentNode, parentNode, espathToValue, jsCode, jsAST);
            if (1 < nodeStack.length) {
                esNode.setParentEsNode(nodeStack[nodeStack.length - 1]);
            }
            nodeStack.push(esNode);
            callback(esNode);
        },
        leave: function (currentNode, parentNode) {
            nodeStack.pop();
        }
    });
}

function extractExpressionFrom (tree) {
    var expressionStatement = tree.body[0],
        expression = expressionStatement.expression;
    return expression;
}

module.exports = traverseContext;
