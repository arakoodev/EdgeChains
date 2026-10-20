declare module "@arakoodev/edgechains.js/sync-rpc" {
  export function createSyncRPC(filename: string): (args: unknown) => string;
}
