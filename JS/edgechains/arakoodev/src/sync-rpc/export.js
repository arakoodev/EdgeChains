console.log(process.env.arakoo);
if (process.env.arakoo) {
    module.exports = function (path) {
        require(path);
    };
} else {
    const createClient = require("./index.js");
    module.exports = createClient;
}
