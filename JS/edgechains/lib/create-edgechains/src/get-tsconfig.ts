import { Options } from "../index.js";

const ts_config = {
    compilerOptions: {
        types: ["dotenv/config", "jest", "node"],
        target: "ES2022",
        module: "NodeNext",
        esModuleInterop: true,
        forceConsistentCasingInFileNames: true,
        strict: true,
        skipLibCheck: true,
        jsx: "react-jsx",
        jsxImportSource: "hono/jsx",
        noImplicitAny: false,
        moduleResolution: "NodeNext",
        declaration: true,
    },
    include: [
        "src/**/*.ts",
        "dist/**/*.d.ts", // include the generated declaration file
    ],
};

export function get_ts_config() {
    return JSON.stringify(ts_config).trim() + "\n";
}
