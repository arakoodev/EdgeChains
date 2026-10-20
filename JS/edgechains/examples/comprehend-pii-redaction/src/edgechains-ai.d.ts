declare module "@arakoodev/edgechains.js/ai" {
  export type ComprehendLikeClient = {
    send(command: any): Promise<any>;
  };

  export class ComprehendPiiRedactor {
    constructor(options?: {
      client?: ComprehendLikeClient;
      region?: string;
      languageCode?: string;
      minScore?: number;
    });

    redact(text: string): Promise<string>;
  }
}
