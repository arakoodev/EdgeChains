'use strict';

var stringifier = require('stringifier'),
    stringWidth = require('./string-width'),
    StringWriter = require('./string-writer'),
    traverseContext = require('./traverse'),
    defaultOptions = require('./options'),
    extend = require('xtend');

(function() {
    // "Browserify can only analyze static requires. It is not in the scope of browserify to handle dynamic requires."
    // https://github.com/substack/node-browserify/issues/377
    require('./renderers/assertion');
    require('./renderers/binary-expression');
    require('./renderers/diagram');
    require('./renderers/file');
})();

function create (options) {
    var config = extend(defaultOptions(), options);
    if (typeof config.widthOf !== 'function') {
        config.widthOf = stringWidth;
    }
    if (typeof config.stringify !== 'function') {
        config.stringify = stringifier(config);
    }
    if (!config.writerClass) {
        config.writerClass = StringWriter;
    }
    return function (context) {
        var writer = new config.writerClass(extend(config)),
            renderers = config.renderers.map(function (rendererName) {
                var RendererClass = require('./renderers/' + rendererName);
                return new RendererClass(extend(config));
            });
        renderers.forEach(function (renderer) {
            renderer.init(context);
        });
        traverseContext(context, renderers);
        renderers.forEach(function (renderer) {
            renderer.render(writer);
        });
        writer.write('');
        return writer.flush();
    };
}

create.defaultOptions = defaultOptions;
create.stringWidth = stringWidth;
module.exports = create;
