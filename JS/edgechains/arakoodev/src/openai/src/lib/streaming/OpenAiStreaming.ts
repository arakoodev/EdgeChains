import { createParser, ParsedEvent, ReconnectInterval } from "eventsource-parser";

export interface OpenAIStreamPayload {
    model?: string;
    OpenApiKey?: string;
    temperature?: number;
    top_p?: number;
    frequency_penalty?: number;
    presence_penalty?: number;
    max_tokens?: number;
    stream?: boolean;
    n?: number;
}

export class Stream {
    model?: string;
    OpenApiKey?: string;
    temperature?: number;
    top_p?: number;
    frequency_penalty?: number;
    presence_penalty?: number;
    max_tokens?: number;
    stream?: boolean;
    n?: number;
    constructor(options: OpenAIStreamPayload = {}) {
        this.model = options.model || "gpt-3.5-turbo";
        this.OpenApiKey = options.OpenApiKey || process.env.OPENAI_API_KEY || "";
        this.temperature = options.temperature || 0.7;
        this.top_p = options.top_p || 1;
        this.frequency_penalty = options.frequency_penalty || 0;
        this.presence_penalty = options.presence_penalty || 0;
        this.max_tokens = options.max_tokens || 500;
        this.stream = options.stream || true;
        this.n = options.n || 1;
    }

    public encoder = new TextEncoder();
    public decoder = new TextDecoder();
    async OpenAIStream(prompt: string): Promise<any> {
        try {
            const res = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${this.OpenApiKey}`,
                    "content-type": "application/json",
                },
                body: JSON.stringify({
                    model: this.model,
                    messages: [{ role: "user", content: prompt }],
                    stream: this.stream,
                    temperature: this.temperature,
                    top_p: this.top_p,
                    n: this.n,
                    presence_penalty: this.presence_penalty,
                    frequency_penalty: this.frequency_penalty,
                    max_tokens: this.max_tokens,
                }),
            });
            const readableStream = new ReadableStream({
                start: async (controller) => {
                    // callback
                    const onParse = (event: ParsedEvent | ReconnectInterval) => {
                        if (event.type === "event") {
                            const data = event.data;
                            controller.enqueue(this.encoder.encode(data));
                        }
                    };

                    // optimistic error handling
                    if (res.status !== 200) {
                        const data = {
                            status: res.status,
                            statusText: res.statusText,
                            body: await res.text(),
                        };
                        console.log(`Error: recieved non-200 status code, ${JSON.stringify(data)}`);
                        controller.close();
                        return;
                    }

                    // stream response (SSE) from OpenAI may be fragmented into multiple chunks
                    // this ensures we properly read chunks and invoke an event for each SSE event stream
                    const parser = createParser(onParse);
                    // https://web.dev/streams/#asynchronous-iteration
                    for await (const chunk of res.body as any) {
                        parser.feed(this.decoder.decode(chunk));
                    }
                },
            });

            let counter = 0;
            const transformStream = new TransformStream({
                transform: async (chunk, controller) => {
                    const data = this.decoder.decode(chunk);
                    // https://beta.openai.com/docs/api-reference/completions/create#completions/create-stream
                    if (data === "[DONE]") {
                        controller.terminate();
                        return;
                    }
                    try {
                        const json = JSON.parse(data);
                        const text = json.choices[0].delta?.content || "";
                        if (counter < 2 && (text.match(/\n/) || []).length) {
                            // this is a prefix character (i.e., "\n\n"), do nothing
                            return;
                        }
                        // stream transformed JSON resposne as SSE
                        const payload = { text: text };
                        // https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events#event_stream_format
                        // controller.enqueue(
                        //     this.encoder.encode(`data: ${JSON.stringify(payload)}\n\n`)
                        // );
                        controller.enqueue(payload.text);
                        counter++;
                    } catch (e) {
                        // maybe parse error
                        console.log(e);
                        controller.error(e);
                    }
                },
            });

            return readableStream.pipeThrough(transformStream).getReader();
        } catch (error) {
            console.log(error);
        }
    }
}
