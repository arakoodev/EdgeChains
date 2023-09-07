'use strict';

var estraverse = require('estraverse'),
    escodegen = require('escodegen'),
    escallmatch = require('escallmatch'),
    espurify = require('espurify'),
    deepCopy = require('./ast-deepcopy'),
    typeName = require('type-name'),
    syntax = estraverse.Syntax,
    supportedNodeTypes = [
        syntax.Identifier,
        syntax.MemberExpression,
        syntax.CallExpression,
        syntax.UnaryExpression,
        syntax.BinaryExpression,
        syntax.LogicalExpression,
        syntax.AssignmentExpression,
        syntax.ObjectExpression,
        syntax.NewExpression,
        syntax.ArrayExpression,
        syntax.ConditionalExpression,
        syntax.UpdateExpression,
        syntax.Property
    ],
    canonicalCodeOptions = {
        format: {
            indent: {
                style: ''
            },
            newline: ''
        },
        verbatim: 'x-verbatim-espower'
    };

// see: https://github.com/Constellation/escodegen/issues/115
if (typeof define === 'function' && define.amd) {
    escodegen = window.escodegen;
}

function Instrumentor (options) {
    ensureOptionPrerequisites(options);
    this.options = options;
    this.matchers = options.patterns.map(escallmatch);
}

Instrumentor.prototype.instrument = function (ast) {
    ensureAstPrerequisites(ast, this.options);
    var that = this,
        assertionPath,
        argumentPath,
        canonicalCode,
        powerAssertCallee,
        lineNum,
        argumentModified = false,
        skipping = false,
        result = (this.options.destructive) ? ast : deepCopy(ast);

    estraverse.replace(result, {
        enter: function (currentNode, parentNode) {
            var controller = this,
                path = controller.path(),
                currentPath = path ? path[path.length - 1] : null;
            //console.log('enter currentNode:' + currentNode.type + ' parentNode: ' + parentNode.type + ' path: ' + path);

            if (argumentPath) {
                if ((!isSupportedNodeType(currentNode)) ||
                    (isLeftHandSideOfAssignment(parentNode, currentPath)) ||
                    (isObjectLiteralKey(parentNode, currentPath)) ||
                    (isUpdateExpression(parentNode)) ||
                    (isCallExpressionWithNonComputedMemberExpression(currentNode, parentNode, currentPath)) ||
                    (isTypeOfOrDeleteUnaryExpression(currentNode, parentNode, currentPath))) {
                    skipping = true;
                    return estraverse.VisitorOption.Skip;
                }
            } else {
                if (!parentNode) {
                    return undefined;
                }
                if (that.matchers.some(function (matcher) { return matcher.test(currentNode); })) {
                    // entering target assertion
                    lineNum = currentNode.loc.start.line;
                    canonicalCode = generateCanonicalCode(currentNode);
                    assertionPath = [].concat(path);
                    powerAssertCallee = guessPowerAssertCalleeFor(currentNode.callee);
                    return undefined;
                }
                if (parentNode.type !== syntax.CallExpression || !isSupportedNodeType(currentNode)) {
                    return undefined;
                }
                if (parentNode.callee === currentNode) {
                    // skip callee
                    return undefined;
                }

                var argumentMatchResults = that.matchers.map(function (matcher) {
                    return matcher.matchArgument(currentNode, parentNode);
                }).filter(function (result) {
                    return result !== null;
                });
                if (argumentMatchResults.length === 1) {
                    if (argumentMatchResults[0].name === 'message' && argumentMatchResults[0].kind === 'optional') {
                        // skip optional message argument
                        return undefined;
                    }
                    // entering target argument
                    argumentPath = [].concat(path);
                    return undefined;
                }
            }
            return undefined;
        },

        leave: function (currentNode, parentNode) {
            var controller = this,
                path = controller.path(),
                resultTree = currentNode,
                relativeEsPath;
            //console.log('leave ' + currentNode.type + ' path: ' + path);

            if (skipping) {
                skipping = false;
                return undefined;
            }

            if (isPathIdentical(assertionPath, path)) {
                // leaving target assertion
                canonicalCode = null;
                lineNum = null;
                assertionPath = null;
                powerAssertCallee = null;
                return undefined;
            }

            if (!argumentPath) {
                return undefined;
            }

            if (isCalleeOfParent(currentNode, parentNode)) {
                return undefined;
            }

            relativeEsPath = path.slice(assertionPath.length);

            //console.log('leave ' + currentNode.type + ' path: ' + path + ' ' + currentNode.name);
            switch(currentNode.type) {
            case syntax.Identifier:
            case syntax.MemberExpression:
            case syntax.CallExpression:
            case syntax.UnaryExpression:
            case syntax.BinaryExpression:
            case syntax.LogicalExpression:
            case syntax.AssignmentExpression:
            case syntax.UpdateExpression:
            case syntax.NewExpression:
                resultTree = that.captureNode(currentNode, relativeEsPath, powerAssertCallee);
                argumentModified = true;
                break;
            default:
                break;
            }

            if (isPathIdentical(argumentPath, path)) {
                // leaving target argument
                argumentPath = null;
                if (argumentModified) {
                    argumentModified = false;
                    return that.captureArgument(resultTree, canonicalCode, powerAssertCallee, lineNum);
                }
            }

            return resultTree;
        }
    });
    return result;
};

Instrumentor.prototype.captureArgument = function (node, canonicalCode, powerAssertCallee, lineNum) {
    var n = newNodeWithLocationCopyOf(node),
        props = [],
        newCallee = updateLocRecursively(espurify(powerAssertCallee), n);
    addLiteralTo(props, n, 'content', canonicalCode);
    addLiteralTo(props, n, 'filepath', this.options.path);
    addLiteralTo(props, n, 'line', lineNum);
    return n({
        type: syntax.CallExpression,
        callee: n({
            type: syntax.MemberExpression,
            computed: false,
            object: newCallee,
            property: n({
                type: syntax.Identifier,
                name: '_expr'
            })
        }),
        arguments: [node].concat(n({
            type: syntax.ObjectExpression,
            properties: props
        }))
    });
};

Instrumentor.prototype.captureNode = function (target, relativeEsPath, powerAssertCallee) {
    var n = newNodeWithLocationCopyOf(target),
        newCallee = updateLocRecursively(espurify(powerAssertCallee), n);
    return n({
        type: syntax.CallExpression,
        callee: n({
            type: syntax.MemberExpression,
            computed: false,
            object: newCallee,
            property: n({
                type: syntax.Identifier,
                name: '_capt'
            })
        }),
        arguments: [
            target,
            n({
                type: syntax.Literal,
                value: relativeEsPath.join('/')
            })
        ]
    });
};

function updateLocRecursively (node, n) {
    estraverse.replace(node, {
        leave: function (currentNode, parentNode) {
            return n(currentNode);
        }
    });
    return node;
}

function guessPowerAssertCalleeFor (node) {
    switch(node.type) {
    case syntax.Identifier:
        return node;
    case syntax.MemberExpression:
        return node.object; // Returns browser.assert when browser.assert.element(selector)
    }
    return null;
}

function generateCanonicalCode(node) {
    var ast = deepCopy(node);
    estraverse.replace(ast, {
        leave: function (currentNode, parentNode) {
            if (currentNode.type === syntax.Literal && typeof currentNode.raw !== 'undefined') {
                currentNode['x-verbatim-espower'] = {
                    content : currentNode.raw,
                    precedence : escodegen.Precedence.Primary
                };
                return currentNode;
            } else {
                return undefined;
            }
        }
    });
    return escodegen.generate(ast, canonicalCodeOptions);
}

function addLiteralTo(props, createNode, name, data) {
    if (data) {
        addToProps(props, createNode, name, createNode({
            type: syntax.Literal,
            value: data
        }));
    }
}

function addToProps(props, createNode, name, value) {
    props.push(createNode({
        type: syntax.Property,
        key: createNode({
            type: syntax.Identifier,
            name: name
        }),
        value: value,
        kind: 'init'
    }));
}

function isCalleeOfParent(currentNode, parentNode) {
    return (parentNode.type === syntax.CallExpression || parentNode.type === syntax.NewExpression) &&
        parentNode.callee === currentNode;
}

function isLeftHandSideOfAssignment(parentNode, currentPath) {
    // Do not instrument left due to 'Invalid left-hand side in assignment'
    return parentNode.type === syntax.AssignmentExpression && currentPath === 'left';
}

function isObjectLiteralKey(parentNode, currentPath) {
    // Do not instrument Object literal key
    return parentNode.type === syntax.Property && parentNode.kind === 'init' && currentPath === 'key';
}

function isUpdateExpression(parentNode) {
    // Just wrap UpdateExpression, not digging in.
    return parentNode.type === syntax.UpdateExpression;
}

function isCallExpressionWithNonComputedMemberExpression(currentNode, parentNode, currentPath) {
    // Do not instrument non-computed property of MemberExpression within CallExpression.
    return currentNode.type === syntax.Identifier && parentNode.type === syntax.MemberExpression && !parentNode.computed && currentPath === 'property';
}

function isTypeOfOrDeleteUnaryExpression(currentNode, parentNode, currentPath) {
    // 'typeof Identifier' or 'delete Identifier' is not instrumented
    return currentNode.type === syntax.Identifier && parentNode.type === syntax.UnaryExpression && (parentNode.operator === 'typeof' || parentNode.operator === 'delete') && currentPath === 'argument';
}

function isPathIdentical(path1, path2) {
    if (!path1 || !path2) {
        return false;
    }
    return path1.join('/') === path2.join('/');
}

function newNodeWithLocationCopyOf (original) {
    return function (newNode) {
        if (typeof original.loc !== 'undefined') {
            newNode.loc = deepCopy(original.loc);
        }
        if (typeof original.range !== 'undefined') {
            newNode.range = deepCopy(original.range);
        }
        return newNode;
    };
}

function isSupportedNodeType (node) {
    return supportedNodeTypes.indexOf(node.type) !== -1;
}

function ensureAstPrerequisites (ast, options) {
    var errorMessage;
    if (typeof ast.loc === 'undefined') {
        errorMessage = 'JavaScript AST should contain location information.';
        if (options.path) {
            errorMessage += ' path: ' + options.path;
        }
        throw new Error(errorMessage);
    }
}

function ensureOptionPrerequisites (options) {
    if (typeName(options.destructive) !== 'boolean') {
        throw new Error('options.destructive should be a boolean value.');
    }
    if (typeName(options.patterns) !== 'Array') {
        throw new Error('options.patterns should be an array.');
    }
}

module.exports = Instrumentor;
