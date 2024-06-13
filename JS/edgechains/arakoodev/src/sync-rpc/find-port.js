// const getPort = require('get-port');
// import getPort from "get-port";
// const getPort = require("get-port");

import("get-port").then((mod) => {
    let getPort = mod.default;
    getPort()
        .then((port) => process.stdout.write("" + port))
        .catch((err) =>
            setTimeout(() => {
                throw err;
            }, 0)
        );
});
