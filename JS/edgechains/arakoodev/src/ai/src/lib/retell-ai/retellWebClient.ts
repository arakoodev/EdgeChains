import { RetellWebClient as RetellClient, StartCallConfig } from "retell-client-js-sdk";

export class RetellWebClient {
    client: RetellClient;
    constructor() {
        this.client = new RetellClient();
    }

    on(event: string, callback: (...args: any[]) => void) {
        return this.client.on(event, callback);
    }

    async startCall(startCallConfig: StartCallConfig) {
        return await this.client.startCall(startCallConfig);
    }

    async stopCall(): Promise<void> {
        return this.client.stopCall();
    }
}
