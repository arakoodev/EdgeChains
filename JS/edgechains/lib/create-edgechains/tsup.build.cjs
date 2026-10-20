const { execSync } = require("child_process");

execSync("rm -rf dist");

execSync("tsup-node index.ts --format esm", { stdio: "inherit" });
