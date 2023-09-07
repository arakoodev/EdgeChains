var syntax = require('estraverse').Syntax;

function EsNode (path, currentNode, parentNode, espathToValue, jsCode, jsAST) {
    if (path) {
        this.espath = path.join('/');
        this.parentEspath = path.slice(0, path.length - 1).join('/');
        this.currentProp = path[path.length - 1];
    } else {
        this.espath = '';
        this.parentEspath = '';
        this.currentProp = null;
    }
    this.currentNode = currentNode;
    this.parentNode = parentNode;
    this.parentEsNode = null;
    this.espathToValue = espathToValue;
    this.jsCode = jsCode;
    this.jsAST = jsAST;
}
EsNode.prototype.setParentEsNode = function (parentEsNode) {
    this.parentEsNode = parentEsNode;
};
EsNode.prototype.getParentEsNode = function () {
    return this.parentEsNode;
};
EsNode.prototype.code = function () {
    return this.jsCode.slice(this.currentNode.loc.start.column, this.currentNode.loc.end.column);
};
EsNode.prototype.value = function () {
    if (this.currentNode.type === syntax.Literal) {
        return this.currentNode.value;
    }
    return this.espathToValue[this.espath];
};
EsNode.prototype.isCaptured = function () {
    return this.espathToValue.hasOwnProperty(this.espath);
};
EsNode.prototype.location = function () {
    return locationOf(this.currentNode, this.jsAST.tokens);
};


function locationOf(currentNode, tokens) {
    switch(currentNode.type) {
    case syntax.MemberExpression:
        return propertyLocationOf(currentNode, tokens);
    case syntax.CallExpression:
        if (currentNode.callee.type === syntax.MemberExpression) {
            return propertyLocationOf(currentNode.callee, tokens);
        }
        break;
    case syntax.BinaryExpression:
    case syntax.LogicalExpression:
    case syntax.AssignmentExpression:
        return infixOperatorLocationOf(currentNode, tokens);
    default:
        break;
    }
    return currentNode.loc;
}

function propertyLocationOf(memberExpression, tokens) {
    var prop = memberExpression.property,
        token;
    if (!memberExpression.computed) {
        return prop.loc;
    }
    token = findLeftBracketTokenOf(memberExpression, tokens);
    return token ? token.loc : prop.loc;
}


// calculate location of infix operator for BinaryExpression, AssignmentExpression and LogicalExpression.
function infixOperatorLocationOf (expression, tokens) {
    var token = findOperatorTokenOf(expression, tokens);
    return token ? token.loc : expression.left.loc;
}


function findLeftBracketTokenOf(expression, tokens) {
    var fromLine = expression.loc.start.line,
        toLine = expression.property.loc.start.line,
        fromColumn = expression.property.loc.start.column;
    return searchToken(tokens, fromLine, toLine, function (token, index) {
        var prevToken;
        if (token.loc.start.column === fromColumn) {
            prevToken = tokens[index - 1];
            if (prevToken.type === 'Punctuator' && prevToken.value === '[') {
                return prevToken;
            }
        }
        return undefined;
    });
}


function findOperatorTokenOf(expression, tokens) {
    var fromLine = expression.left.loc.end.line,
        toLine = expression.right.loc.start.line,
        fromColumn = expression.left.loc.end.column,
        toColumn = expression.right.loc.start.column;
    return searchToken(tokens, fromLine, toLine, function (token, index) {
        if (fromColumn < token.loc.start.column &&
            token.loc.end.column < toColumn &&
            token.type === 'Punctuator' &&
            token.value === expression.operator) {
            return token;
        }
        return undefined;
    });
}


function searchToken(tokens, fromLine, toLine, predicate) {
    var i, token, found;
    for(i = 0; i < tokens.length; i += 1) {
        token = tokens[i];
        if (token.loc.start.line < fromLine) {
            continue;
        }
        if (toLine < token.loc.end.line) {
            break;
        }
        found = predicate(token, i);
        if (found) {
            return found;
        }
    }
    return undefined;
}


module.exports = EsNode;
