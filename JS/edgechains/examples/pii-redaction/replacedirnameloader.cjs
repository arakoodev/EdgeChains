const path = require("path");

module.exports = function (source) {
    // console.log(source)
    return source.replace(/__dirname/g, (match, p1) => {
        // try {
        return `"${this.context}"`;
        // } catch (error) {
        // console.log("error ",error)
        // return match;
        // }
        // return `require('${filePath}')`;
    });
};
