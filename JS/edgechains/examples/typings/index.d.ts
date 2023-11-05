export type EmptyObject = Record<string, never>;

export interface AppConfig {
  app: {
    name: string;
    version: string;
  };
  auth0: {
    audience: string;
    issuer: string;
    clientId: string;
    clientSecret: string;
  };
  db: {
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
  };
  frontend: {
    url: string;
  };
  server: {
    address: string;
    port: number;
  };
}
