/**
 * espower - Power Assert feature instrumentor based on the Mozilla JavaScript AST.
 *
 * https://github.com/twada/espower
 *
 * Copyright (c) 2013-2014 Takuto Wada
 * Licensed under the MIT license.
 *   https://github.com/twada/espower/blob/master/MIT-LICENSE.txt
 */
'use strict';

var defaultOptions = require('./lib/default-options'),
    Instrumentor = require('./lib/instrumentor'),
    deepCopy = require('./lib/ast-deepcopy'),
    extend = require('xtend');

/**
 * Instrument power assert feature into code. Mozilla JS AST in, Mozilla JS AST out.
 * @param ast JavaScript Mozilla JS AST to instrument (directly modified if destructive option is truthy)
 * @param options Instrumentation options.
 * @return instrumented AST
 */
function espower (ast, options) {
    var instrumentor = new Instrumentor(extend(defaultOptions(), options));
    return instrumentor.instrument(ast);
}

espower.deepCopy = deepCopy;
espower.defaultOptions = defaultOptions;
module.exports = espower;
