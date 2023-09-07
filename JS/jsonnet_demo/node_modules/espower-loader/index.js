/**
 * espower-loader - Power Assert feature instrumentor on the fly.
 *
 * https://github.com/twada/espower-loader
 *
 * Copyright (c) 2013-2014 Takuto Wada
 * Licensed under the MIT license.
 *   https://github.com/twada/espower-loader/blob/master/MIT-LICENSE.txt
 */
var extensions = require.extensions,
    originalLoader = extensions['.js'],
    fs = require('fs'),
    minimatch = require('minimatch'),
    espowerSourceToSource = require('espower-source');

function espowerLoader (options) {
    'use strict';

    var separator = (options.pattern.lastIndexOf('/', 0) === 0) ? '' : '/',
        pattern = options.cwd + separator + options.pattern;

    extensions['.js'] = function(localModule, filepath) {
        var output;
        if (minimatch(filepath, pattern)){
            output = espowerSourceToSource(fs.readFileSync(filepath, 'utf-8'), filepath, options.espowerOptions);
            localModule._compile(output, filepath);
        } else {
            originalLoader(localModule, filepath);
        }
    };
}

module.exports = espowerLoader;
