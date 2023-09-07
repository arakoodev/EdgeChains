'use strict';

module.exports = function capturable () {
    var events = [];

    function _capt (value, espath) {
        events.push({value: value, espath: espath});
        return value;
    }

    function _expr (value, args) {
        var captured = events;
        events = [];
        return {
            powerAssertContext: {
                value: value,
                events: captured
            },
            source: {
                content: args.content,
                filepath: args.filepath,
                line: args.line
            }
        };
    }

    return {
        _capt: _capt,
        _expr: _expr
    };
};
