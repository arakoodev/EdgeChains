import { Palm2 } from "@arakoodev/edgechains.js/ai";

export default function generateResponse(args: {
    prompt: string;
    palm2ApiKey: string;
    model?: string;
    temperature?: number;
}) {
    const palm2 = new Palm2({ apiKey: args.palm2ApiKey });
    return palm2.chat({
        prompt: args.prompt,
        model: args.model || "chat-bison-001",
        temperature: args.temperature || 0.7,
    });
}
