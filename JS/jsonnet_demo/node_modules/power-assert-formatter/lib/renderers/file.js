function FileRenderer (config) {
}

FileRenderer.prototype.init = function (context) {
    this.filepath = context.source.filepath;
    this.lineNumber = context.source.line;
};

FileRenderer.prototype.onEachEsNode = function (esNode) {
};

FileRenderer.prototype.render = function (writer) {
    if (this.filepath) {
        writer.write('# ' + [this.filepath, this.lineNumber].join(':'));
    } else {
        writer.write('# at line: ' + this.lineNumber);
    }
};

module.exports = FileRenderer;
