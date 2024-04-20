"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ArakooServer = void 0;
const node_server_1 = require("@hono/node-server");
const hono_1 = require("hono");
const streaming_1 = require("hono/streaming");
class ArakooServer {
    app = new hono_1.Hono();
    Stream = streaming_1.stream;
    createApp() {
        return this.app;
    }
    listen(port) {
        const portNumber = port || 3000;
        (0, node_server_1.serve)(
            {
                fetch: this.app.fetch,
                port: portNumber,
            },
            () => {
                console.log(`Server running on port ${portNumber}`);
            }
        );
    }
}
exports.ArakooServer = ArakooServer;
