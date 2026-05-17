import { OpenAI } from "../openai/openai.js";
import { GeminiAI } from "../gemini/gemini.js";
import { LlamaAI } from "../llama/llama.js";
import { RetellAI } from "../retell-ai/retell.js";

export interface RouterConfig {
    defaultModel: string;
    modelMapping: {
        [key: string]: {
            provider: 'openai' | 'gemini' | 'llama' | 'retell';
            modelName: string;
        };
    };
}

export class SmartRouter {
    private providers: {
        openai?: OpenAI;
        gemini?: GeminiAI;
        llama?: LlamaAI;
        retell?: RetellAI;
    };

    constructor(private config: RouterConfig) {
        this.initProviders();
    }

    private initProviders() {
        this.providers.openai = new OpenAI({});
        this.providers.gemini = new GeminiAI({});
        this.providers.llama = new LlamaAI({});
        this.providers.retell = new RetellAI({});
    }

    async route(model: string, prompt: string, options: any = {}) {
        const target = this.config.modelMapping[model] || {
            provider: this.config.defaultModel as any, 
            modelName: model
        };

        switch (target.provider) {
            case 'openai':
                return await this.providers.openai!.chat({ 
                    model: target.modelName, 
                    prompt, 
                    ...options 
                });
            case 'gemini':
                return await this.providers.gemini!.chat({ 
                    prompt, 
                    ...options 
                });
            case 'llama':
                return await this.providers.llama!.chat({ 
                    model: target.modelName, 
                    prompt, 
                    ...options 
                });
            case 'retell':
                return await this.providers.retell!.chat({ 
                    prompt, 
                    ...options 
                });
            default:
                throw new Error(`Unsupported provider: ${target.provider}`);
        }
    }
}
