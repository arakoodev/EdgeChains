// Palm2Endpoint.ts â€” Google PaLM 2 API support for EdgeChains JS/TS SDK (Fixes #279)
export interface Palm2EndpointOptions {
  apiKey: string;
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
  topP?: number;
  topK?: number;
  baseUrl?: string;
}

export class Palm2Endpoint {
  private apiKey: string;
  private model: string;
  private temperature: number;
  private maxOutputTokens: number;
  private topP?: number;
  private topK?: number;
  private baseUrl: string;

  constructor(options: Palm2EndpointOptions) {
    if (!options?.apiKey) {
      throw new Error("Palm2Endpoint requires a valid Google PaLM 2 apiKey");
    }
    this.apiKey = options.apiKey;
    this.model = options.model ?? "text-bison-001";
    this.temperature = options.temperature ?? 0.2;
    this.maxOutputTokens = options.maxOutputTokens ?? 1024;
    this.topP = options.topP;
    this.topK = options.topK;
    this.baseUrl = options.baseUrl ?? "https://generativelanguage.googleapis.com/v1beta2";
  }

  async generateText(prompt: string): Promise<string> {
    const url = `${this.baseUrl}/models/${this.model}:generateText?key=${encodeURIComponent(this.apiKey)}`;
    const payload: Record<string, unknown> = {
      prompt: { text: prompt },
      temperature: this.temperature,
      maxOutputTokens: this.maxOutputTokens,
    };
    if (this.topP !== undefined) payload.topP = this.topP;
    if (this.topK !== undefined) payload.topK = this.topK;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      throw new Error(`PaLM 2 API error (${response.status}): ${await response.text()}`);
    }
    const data = (await response.json()) as { candidates?: Array<{ output?: string }> };
    return data.candidates?.[0]?.output ?? "";
  }
}
