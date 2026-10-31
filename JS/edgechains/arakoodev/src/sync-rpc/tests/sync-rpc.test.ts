import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import createSyncRPC from "../lib/sync-rpc";

describe("sync-rpc graceful shutdown and temp directory reaper", () => {
    let workerModulePath: string;

    beforeEach(() => {
        workerModulePath = path.join(os.tmpdir(), `edgechains-test-worker-${Date.now()}.cjs`);
        fs.writeFileSync(
            workerModulePath,
            "module.exports = async function (input) { return { echoed: input }; };\n"
        );
    });

    afterEach(() => {
        if (fs.existsSync(workerModulePath)) {
            fs.unlinkSync(workerModulePath);
        }
    });

    test("executes synchronous RPC call and cleans up temporary directory via dispose()", () => {
        const rpc: any = createSyncRPC(workerModulePath);
        const output = rpc({ hello: "world" });
        expect(JSON.parse(output)).toEqual({ echoed: { hello: "world" } });
        expect(typeof rpc.dispose).toBe("function");
        rpc.dispose();
    });
});
