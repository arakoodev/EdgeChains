const ts_config = {
    compilerOptions: {
      types: ["dotenv/config", "jest"],
      target: "es2016",
      module: "commonjs", 
      esModuleInterop: true,
      forceConsistentCasingInFileNames: true,
      strict: true,
      skipLibCheck: true,
      jsx: "react-jsx",
      jsxImportSource: "hono/jsx"
    }
  }

function get_ts_config() {
    return JSON.stringify(ts_config).trim() + "\n";
}

export { get_ts_config };