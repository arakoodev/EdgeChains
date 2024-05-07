import { ArakooServer } from "../../../../../dist/arakooserver/src/lib/hono/hono.js";
import { Hono } from "hono";

describe("ArakooServer", () => {
    let arakooServer = new ArakooServer();

    test("createApp should return an instance of Hono", () => {
        const app = arakooServer.createApp();

        expect(app).toBeInstanceOf(Hono);
    }, 10000);
});
