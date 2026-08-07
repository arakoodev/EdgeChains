export interface Palm2Config {
  apiKey: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
}

export interface Palm2Request {
  prompt: string;
  temperature?: number;
  maxTokens?: number;
}

export interface Palm2Response {
  text: string;
  finishReason?: string;
}

export class Palm2 {
  private config: Palm2Config;

  constructor(config: Palm2Config) {
    this.config = config;
  }

  async generate(request: Palm2Request): Promise<Palm2Response> {
    const url = 'https://generativelanguage.googleapis.com/v1/models/palm2:generateText';
    const body = {
      prompt: { text: request.prompt },
      temperature: request.temperature ?? this.config.temperature ?? 0.7,
      maxOutputTokens: request.maxTokens ?? this.config.maxTokens ?? 1024
    };
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': this.config.apiKey },
      body: JSON.stringify(body)
    });

    const data = await response.json();
    return { text: data.candidates?.[0]?.output || '', finishReason: 'STOP' };
  }
}
