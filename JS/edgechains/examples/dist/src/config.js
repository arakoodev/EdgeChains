"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const package_json_1 = require("../package.json");
function ensureValues(key, defaultValue, throwOnMissing = true) {
    const value = process.env[key];
    if (value === undefined) {
        if (defaultValue) {
            console.error(
                `Config missing env.${key} - the default value '${defaultValue}' will be used`
            );
            return defaultValue;
        }
        if (throwOnMissing) throw new Error(`Config missing env.${key}`);
    }
    return value;
}
exports.default = () => ({
    app: {
        name: package_json_1.name,
        version: package_json_1.version,
    },
    auth0: {
        audience: ensureValues("AUTH0_AUDIENCE"),
        issuer: ensureValues("AUTH0_ISSUER_URL"),
        clientId: ensureValues("AUTH0_CLIENT_ID"),
        clientSecret: ensureValues("AUTH0_CLIENT_SECRET"),
    },
    db: {
        host: ensureValues("DB_HOST"),
        port: parseInt(ensureValues("DB_PORT"), 10),
        username: ensureValues("DB_USERNAME"),
        password: ensureValues("DB_PASSWORD"),
        database: ensureValues("DB_DATABASE"),
    },
    frontend: {
        url: ensureValues("FRONTEND_URL", undefined, false),
    },
    server: {
        address: ensureValues("SERVER_ADDRESS", "127.0.0.1"),
        port: parseInt(ensureValues("SERVER_PORT", "3001"), 10),
    },
});
//# sourceMappingURL=config.js.map
