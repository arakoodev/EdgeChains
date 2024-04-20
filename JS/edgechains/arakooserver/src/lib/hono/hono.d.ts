import { Hono } from "hono";
export declare class ArakooServer {
    app: Hono<import("hono").Env, import("hono/types").BlankSchema, "/">;
    Stream: (
        c: import("hono").Context<any, any, {}>,
        cb: (stream: import("hono/utils/stream").StreamingApi) => Promise<void>,
        onError?:
            | ((e: Error, stream: import("hono/utils/stream").StreamingApi) => Promise<void>)
            | undefined
    ) => Response;
    createApp(): Hono<import("hono").Env, import("hono/types").BlankSchema, "/">;
    listen(port?: number): void;
}
