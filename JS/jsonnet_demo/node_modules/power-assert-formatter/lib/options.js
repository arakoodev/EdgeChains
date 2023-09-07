module.exports = function defaultOptions () {
    'use strict';
    return {
        lineDiffThreshold: 5,
        maxDepth: 1,
        anonymous: 'Object',
        circular: '#@Circular#',
        lineSeparator: '\n',
        renderers: [
            'file',
            'assertion',
            'diagram',
            'binary-expression'
        ]
    };
};
