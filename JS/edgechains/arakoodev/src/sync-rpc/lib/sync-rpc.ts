import { execFileSync } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import os from "node:os";

const activeTempDirs = new Set<string>();
let cleanupRegistered = false;

function cleanupAllTempDirs() {
    for (const dir of Array.from(activeTempDirs)) {
        try {
            if (fs.existsSync(dir)) {
                fs.rmSync(dir, { recursive: true, force: true });
            }
        } catch {
            // Ignore cleanup error during process teardown
        }
    }
    activeTempDirs.clear();
}

function registerTempCleanupOnce() {
    if (cleanupRegistered) return;
    cleanupRegistered = true;

    process.once("exit", cleanupAllTempDirs);
    process.once("SIGINT", () => {
        cleanupAllTempDirs();
        process.exit(130);
    });
    process.once("SIGTERM", () => {
        cleanupAllTempDirs();
        process.exit(143);
    });
}

function createSyncRPC(filename: string) {
    registerTempCleanupOnce();
    const absolutePath = path.resolve(filename);

    if (!fs.existsSync(absolutePath)) {
        throw new Error(`File not found: ${absolutePath}`);
    }

    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "sync-rpc-"));
    activeTempDirs.add(tempDir);

    const hash = crypto.createHash("md5").update(absolutePath).digest("hex");
    const wrapperPath = path.join(tempDir, `wrapper_${hash}.js`);

    const wrapperCode = `
    const fn = require(${JSON.stringify(absolutePath)});
    if (typeof fn !== 'function') {
      throw new Error('Exported value is not a function');
    }
    const parentPid = process.ppid;
    if (parentPid && parentPid > 1) {
      const watchdog = setInterval(() => {
        try {
          process.kill(parentPid, 0);
        } catch (_) {
          process.exit(0);
        }
      }, 1000);
      if (watchdog && typeof watchdog.unref === 'function') watchdog.unref();
    }
    process.once('SIGTERM', () => process.exit(0));
    process.once('SIGINT', () => process.exit(0));
    process.on('message', (message) => {
      Promise.resolve(fn(message))
        .then(result => {
          process.send({ success: true, result });
        })
        .catch(error => {
          process.send({ success: false, error: error.message });
        });
    });
  `;

    fs.writeFileSync(wrapperPath, wrapperCode);

    const syncRPC = function syncRPC(args: any) {
        const scriptPath = path.join(tempDir, `script_${Date.now()}.js`);
        const scriptContent = `
      const cp = require('child_process');
      const child = cp.fork(${JSON.stringify(wrapperPath)});
      function reapChild() {
        try {
          if (!child.killed && child.exitCode === null) {
            child.kill('SIGTERM');
          }
        } catch (_) {}
      }
      process.once('SIGTERM', () => { reapChild(); process.exit(143); });
      process.once('SIGINT', () => { reapChild(); process.exit(130); });
      process.once('exit', reapChild);
      child.send(${JSON.stringify(args)});
      child.on('message', (message) => {
        console.log(JSON.stringify(message));
        reapChild();
        process.exit(0);
      });
    `;

        fs.writeFileSync(scriptPath, scriptContent);

        try {
            const output = execFileSync(process.execPath, [scriptPath], {
                encoding: "utf8",
                stdio: ["pipe", "pipe", "inherit"],
            });

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
            if (error) {
                console.error("Execution error:", error.message);
                if (error.stderr) {
                    console.error("stderr:", error.stderr);
                }
                throw new Error(`Execution error: ${error.message}`);
            }
            throw error;
        } finally {
            try {
                if (fs.existsSync(scriptPath)) {
                    fs.unlinkSync(scriptPath);
                }
            } catch {
                // Preserve original error
            }
        }
    };

    (syncRPC as any).dispose = () => {
        try {
            if (fs.existsSync(tempDir)) {
                fs.rmSync(tempDir, { recursive: true, force: true });
            }
            activeTempDirs.delete(tempDir);
        } catch {
            // Ignore cleanup failure
        }
    };

    return syncRPC;
}

export = createSyncRPC as Function;
