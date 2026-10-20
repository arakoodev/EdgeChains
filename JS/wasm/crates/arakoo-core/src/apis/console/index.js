globalThis.process = {
    env: {},
};

console.debug = function (...msg) {
    let str = "QUICKJS ENGINE DEBUG - ";
    if (process.env.JS_LOG == "debug") {
        for (let i = 0; i < msg.length; i++) {
            str += msg[i];
        }
        console.log(str);
    }
};

console.info = function (...msg) {
    let str = "QUICKJS ENGINE INFO - ";
    if (process.env.JS_LOG == "debug" || process.env.JS_LOG == "info") {
        for (let i = 0; i < msg.length; i++) {
            str += msg[i];
        }
        console.log(str);
    }
};

console.error = function (...msg) {
    let str = "QUICKJS ENGINE ERROR - ";
    for (let i = 0; i < msg.length; i++) {
        str += msg[i];
    }
    console.log(str);
};
