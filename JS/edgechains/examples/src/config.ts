import { name, version } from '../package.json';
import { AppConfig } from '../typings';

/**
 * Ensure env variables are set
 * @param {string} key the env variable
 * @param {string} defaultValue defualt value to be used when env is missing
 * @param {boolean} throwOnMissing throw error on missing or no default value is provided
 * @returns
 */
function ensureValues(key: string, defaultValue?: string, throwOnMissing = true): string {
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
    return value as string;
}

/** All app settings */
export default (): AppConfig => ({
    app: {
        name,
        version,
    },
    auth0: {
        audience: ensureValues('AUTH0_AUDIENCE'),
        issuer: ensureValues('AUTH0_ISSUER_URL'),
        clientId: ensureValues('AUTH0_CLIENT_ID'),
        clientSecret: ensureValues('AUTH0_CLIENT_SECRET'),
    },
    db: {
        host: ensureValues('DB_HOST'),
        port: parseInt(ensureValues('DB_PORT'), 10),
        username: ensureValues('DB_USERNAME'),
        password: ensureValues('DB_PASSWORD'),
        database: ensureValues('DB_DATABASE'),
    },
    frontend: {
        url: ensureValues('FRONTEND_URL', undefined, false),
    },
    server: {
        address: ensureValues('SERVER_ADDRESS', '127.0.0.1'),
        port: parseInt(ensureValues('SERVER_PORT', '3001'), 10),
    },
});
