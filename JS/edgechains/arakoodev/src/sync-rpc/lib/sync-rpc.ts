import { execSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import os from "node:os";

function createSyncRPC(filename: string) {
    const absolutePath = path.resolve(filename);

    if (!fs.existsSync(absolutePath)) {
        throw new Error(`File not found: ${absolutePath}`);
    }

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "sync-rpc-"));
    const hash = crypto.createHash("md5").update(absolutePath).digest("hex");
    const wrapperPath = path.join(tempDir, `wrapper_${hash}.js`);

    const wrapperCode = `
    const fn = require(${JSON.stringify(absolutePath)});
    if (typeof fn !== 'function') {
      throw new Error('Exported value is not a function');
    }
    process.on('message', (message) => {
      fn(message)
        .then(result => {
          process.send({ success: true, result });
        })
        .catch(error => {
          process.send({ success: false, error: error.message });
        });
    });
  `;

    fs.writeFileSync(wrapperPath, wrapperCode);

    return function syncRPC(args: any) {
        const scriptPath = path.join(tempDir, `script_${Date.now()}.js`);
        const scriptContent = `
      const cp = require('child_process');
      const child = cp.fork(${JSON.stringify(wrapperPath)});
      child.send(${JSON.stringify(args)});
      child.on('message', (message) => {
        console.log(JSON.stringify(message));
        child.kill();
        process.exit(0);
      });
    `;

        fs.writeFileSync(scriptPath, scriptContent);

        try {
            const output = execSync(`node ${scriptPath}`, {
                encoding: "utf8",
                stdio: ["pipe", "pipe", "inherit"],
            });

            fs.unlinkSync(scriptPath);

            const trimmedOutput = output.trim();

            try {
                const result = JSON.parse(trimmedOutput);
                if (!result.success) {
                    throw new Error(result.error);
                }
                return JSON.stringify(result.result);
            } catch (parseError: any) {
                console.error("Raw output:", trimmedOutput);
                throw new Error(
                    `Failed to parse output as JSON: ${parseError.message}\nRaw output: ${trimmedOutput}`
                );
            }
        } catch (error: any) {
            fs.unlinkSync(scriptPath);
            if (error) {
                console.error("Execution error:", error.message);
                if (error.stderr) {
                    console.error("stderr:", error.stderr);
                }
                throw new Error(`Execution error: ${error.message}`);
            }
            throw error;
        }
    };
}

export = createSyncRPC as Function;
