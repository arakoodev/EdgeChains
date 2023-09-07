function StringWriter (config) {
    this.lines = [];
    this.lineSeparator = config.lineSeparator;
}

StringWriter.prototype.write = function (str) {
    this.lines.push(str);
};

StringWriter.prototype.flush = function () {
    var str = this.lines.join(this.lineSeparator);
    this.lines.length = 0;
    return str;
};

module.exports = StringWriter;
