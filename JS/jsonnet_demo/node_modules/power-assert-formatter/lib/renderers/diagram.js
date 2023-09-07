function DiagramRenderer (config) {
    this.config = config;
    this.events = [];
    this.stringify = config.stringify;
    this.widthOf = config.widthOf;
    this.initialVertivalBarLength = 1;
}

DiagramRenderer.prototype.init = function (context) {
    this.context = context;
    this.assertionLine = context.source.content;
    this.initializeRows();
};

DiagramRenderer.prototype.onEachEsNode = function (esNode) {
    if (!esNode.isCaptured()) {
        return;
    }
    this.events.push({value: esNode.value(), loc: esNode.location()});
};

DiagramRenderer.prototype.render = function (writer) {
    this.events.sort(rightToLeft);
    this.constructRows(this.events);
    this.rows.forEach(function (columns) {
        writer.write(columns.join(''));
    });
};

DiagramRenderer.prototype.initializeRows = function () {
    this.rows = [];
    for (var i = 0; i <= this.initialVertivalBarLength; i += 1) {
        this.addOneMoreRow();
    }
};

DiagramRenderer.prototype.newRowFor = function (assertionLine) {
    return createRow(this.widthOf(assertionLine), ' ');
};

DiagramRenderer.prototype.addOneMoreRow = function () {
    this.rows.push(this.newRowFor(this.assertionLine));
};

DiagramRenderer.prototype.lastRow = function () {
    return this.rows[this.rows.length - 1];
};

DiagramRenderer.prototype.renderVerticalBarAt = function (columnIndex) {
    var i, lastRowIndex = this.rows.length - 1;
    for (i = 0; i < lastRowIndex; i += 1) {
        this.rows[i].splice(columnIndex, 1, '|');
    }
};

DiagramRenderer.prototype.renderValueAt = function (columnIndex, dumpedValue) {
    var i, width = this.widthOf(dumpedValue);
    for (i = 0; i < width; i += 1) {
        this.lastRow().splice(columnIndex + i, 1, dumpedValue.charAt(i));
    }
};

DiagramRenderer.prototype.isOverlapped = function (prevCapturing, nextCaputuring, dumpedValue) {
    return (typeof prevCapturing !== 'undefined') && this.startColumnFor(prevCapturing) <= (this.startColumnFor(nextCaputuring) + this.widthOf(dumpedValue));
};

DiagramRenderer.prototype.constructRows = function (capturedEvents) {
    var that = this,
        prevCaptured;
    capturedEvents.forEach(function (captured) {
        var dumpedValue = that.stringify(captured.value);
        if (that.isOverlapped(prevCaptured, captured, dumpedValue)) {
            that.addOneMoreRow();
        }
        that.renderVerticalBarAt(that.startColumnFor(captured));
        that.renderValueAt(that.startColumnFor(captured), dumpedValue);
        prevCaptured = captured;
    });
};

DiagramRenderer.prototype.startColumnFor = function (captured) {
    return this.widthOf(this.assertionLine.slice(0, captured.loc.start.column));
};

function createRow (numCols, initial) {
    var row = [], i;
    for(i = 0; i < numCols; i += 1) {
        row[i] = initial;
    }
    return row;
}

function rightToLeft (a, b) {
    return b.loc.start.column - a.loc.start.column;
}

module.exports = DiagramRenderer;
