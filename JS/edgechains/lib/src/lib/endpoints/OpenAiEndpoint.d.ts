interface ChatOpenAiOptions {
    url?: string;
    openAIApiKey?: string;
    orgId?: string;
    model?: string;
    role?: string;
    temperature?: number;
}
export declare class ChatOpenAi {
    url: string;
    openAIApiKey: string;
    orgId: string;
    model: string;
    role: string;
    temperature: number;
    constructor(options?: ChatOpenAiOptions);
    generateResponse(prompt: string): Promise<string>;
    generateEmbeddings(resp: any): Promise<any>;
    chatWithAI(chatMessages: any): Promise<any>;
    testResponseGeneration(prompt: string): Promise<string>;
}
export {};
