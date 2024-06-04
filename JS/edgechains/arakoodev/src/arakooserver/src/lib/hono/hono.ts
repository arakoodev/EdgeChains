// src/arakooServer.ts
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";

export class ArakooServer {
    app: Hono;

    constructor() {
        this.app = new Hono();
    }

    useCors(allowedEndpoints?: string, options?: any) {
        this.app.use(allowedEndpoints || "*", cors(options));
    }

    createApp(): Hono {
        return this.app;
    }

    listen(port?: number) {
        const portNumber = port || 3000;

        serve(
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
