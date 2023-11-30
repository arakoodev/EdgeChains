export declare class OpenAiEndpoint {
    url: string;
    apiKey: string;
    orgId: string;
    model: string;
    role: string;
    temprature: number;
    constructor(url: string, apiKey: string, orgId: string, model: string, role: string, temprature: number);
    gptFn(prompt: string): Promise<string>;
    embeddings(resp: string): Promise<number[]>;
    gptFnChat(chatMessages: any): Promise<any>;
    gptFnTestGenerator(prompt: string): Promise<string>;
}
