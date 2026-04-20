const net = require("net");
const { fileURLToPath } = require("url");
const INIT = 1;
const CALL = 0;
const modules = [];

const server = net.createServer({ allowHalfOpen: true }, (c) => {
    let responded = false;
    function respond(data) {
        if (responded) return;
        responded = true;
        c.end(JSON.stringify(data));
    }
    let buffer = "";
    function onMessage(str) {
        if (str === "ping") {
            c.end("pong");
            return;
        }
        const req = JSON.parse(str);
        if (req.t === INIT) {
            // console.log("Init", req.f)
            let id = init(req.f);
            // console.log("ID", id)
            respond({ s: true, v: id });
        } else {
            let result = modules[req.i](req.a);
            // console.log("typeof result ", typeof result)
            // console.log("Resutl constr name",result.constructor)
            result.then(
                function (response) {
                    respond({ s: true, v: response });
                },
                function (err) {
                    respond({ s: false, v: { code: err.code, message: err.message } });
                }
            );
        }
    }
    c.on("error", function (err) {
        respond({ s: false, v: { code: err.code, message: err.message } });
    });
    c.on("data", function (data) {
        // console.log("Data", data);
        buffer += data.toString("utf8");
        // console.log("Buffer", buffer);
        if (/\r\n/.test(buffer)) {
            onMessage(buffer.trim());
        }
    });
});

function init(filename) {
    let filePath;
    try {
        filePath = fileURLToPath(filename);
    } catch (error) {
        filePath = filename;
    }
    let module = require(filePath);
    // console.log("typeof module", typeof module);
    // console.log("typeof module.default", typeof module.default);
    if (module && typeof module === "object" && typeof module.default === "function") {
        module = module.default;
    }
    if (typeof module !== "function") {
        throw new Error(filename + " did not export a function.");
    }
    const i = modules.length;
    // console.log("I", i)
    modules[i] = module;
    return i;
}

// server.listen(6553);
server.listen(process.argv[2]);
