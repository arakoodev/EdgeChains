if (process.env.arakoo) {
    module.exports = function (path) {
        // should not run
        console.debug("This function should not run");
    };
} else {
    const createClient = require("./index.js");
    module.exports = createClient;
}
