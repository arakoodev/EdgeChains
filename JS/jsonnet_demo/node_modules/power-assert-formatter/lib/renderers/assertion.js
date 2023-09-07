function AssertionRenderer (config) {
}

AssertionRenderer.prototype.init = function (context) {
    this.assertionLine = context.source.content;
};

AssertionRenderer.prototype.onEachEsNode = function (esNode) {
};

AssertionRenderer.prototype.render = function (writer) {
    writer.write('');
    writer.write(this.assertionLine);
};

module.exports = AssertionRenderer;
