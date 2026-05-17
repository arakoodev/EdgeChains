// import fs from "fs";
const fs = require("fs");

function read_file(path) {
    return fs.readFileSync(path, { encoding: "utf8" });
}

module.exports = { read_file };
