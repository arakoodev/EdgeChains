
import axios from "axios";
import { retry } from "@lifeomic/attempt";
const url = "https://api.groq.com/openai/v1/chat/completions";

interface GroqAIConstructionOptions {
    apiKey?: string;
}

type Role = "system" | "user" | "assistant";

type Message = {
    role: Role;
    content: string;
};

type Choice = {
    index: number;
    message: Message;
    logprobs: null | Record<string, unknown>;
    finish_reason: string;
};

type Usage = {
    queue_time: number;
    prompt_tokens: number;
    prompt_time: number;
    completion_tokens: number;
    completion_time: number;
    total_tokens: number;
    total_time: number;
};

type XGroq = {
    id: string;
};

type GroqResponse = {
    id: string;
    object: string;
    created: number;
    model: string;
    choices: Choice[];
    usage: Usage;
    system_fingerprint: string;
    x_groq: XGroq;
};

type responseMimeType = "text/plain" | "application/json";
// type fileMimeType = "image/png" | "image/jpeg" | "image/webp" | "image/heic" | "image/heif";

interface GroqAIChatOptions {
    model: string;
    max_output_tokens?: number;
    temperature?: number;
    prompt: string;
    systemPrompt?:string
    max_retry?: number;
    responseType?: responseMimeType;
    delay?: number;
    top_p?:number;
}

// Will add support for it later

// interface GroqAIFileChatOptions extends GroqAIChatOptions{
//     file:{
//         uri:string,
//         mimeType:fileMimeType,
//     }
// }

export class Groq {
    apiKey: string;
    constructor(options: GroqAIConstructionOptions) {
        this.apiKey = options.apiKey || process.env.GROQ_API_KEY || "";
    }

    async chat(chatOptions: GroqAIChatOptions): Promise<GroqResponse> {
        let data:null | string =null;
        if(chatOptions.responseType=="application/json"){
            data = JSON.stringify({
                messages: [
                    {
                        role: "system",
                        content: chatOptions.systemPrompt || ""
                      },
                    {
                        role: "user",
                        content:chatOptions.prompt
                    },
                ],
                model:chatOptions.model,
                temperature:chatOptions.temperature||1,
                max_tokens:chatOptions.max_output_tokens||1024,
                top_p:chatOptions.top_p||1,
                response_format: {
                    type: "json_object"
                },
            });
        }else{
            data = JSON.stringify({
                messages: [
                    {
                        role: "system",
                        content: chatOptions.systemPrompt || ""
                      },
                    {
                        role: "user",
                        content:chatOptions.prompt
                    },
                ],
                model:chatOptions.model,
                temperature:chatOptions.temperature||1,
                max_tokens:chatOptions.max_output_tokens||1024,
                top_p:chatOptions.top_p||1,
            });
        }   
        
        const config = {
            method: "post",
            maxBodyLength: Infinity,
            url,
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${this.apiKey}`,
            },
            data,
        };

    
        return await retry(
            async () => {
                return (await axios.request(config)).data as GroqResponse;
            },
            { maxAttempts: chatOptions.max_retry || 3, delay: chatOptions.delay || 200 }
        );
    }
    
    
}
