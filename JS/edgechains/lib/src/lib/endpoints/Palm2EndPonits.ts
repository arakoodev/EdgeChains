import axios from "axios";

export class Palm2Endpoint {
  url: string;
  apiKey: string;

  constructor(url: string, apiKey: string) {
    this.url = url;
    this.apiKey = apiKey;
  }

  async generateMessage(model: string): Promise<any> {
    const config = {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
    };

    try {
      const response = await axios.post(
        `${this.url}/v1beta3/models/${model}:generateMessage?key=${this.apiKey}`,
        null, 
        config
      );
      return response.data.candidates[0].content;
    } catch (error) {
      console.error("Error making API call:", error);
      throw error;
    }
  }

  async generateText(
    model: string,
    prompt: string,
    temperature: number | null = null,
    candidateCount: number | null = null
  ): Promise<any> {
    const requestData = {
      prompt,
      temperature,
      candidate_count: candidateCount,
    };

    const config = {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
    };

    try {
      const response = await axios.post(
        `${this.url}/v1beta3/models/${model}:generateText?key=${this.apiKey}`,
        requestData,
        config
      );
      return response.data.candidates[0].output;
    } catch (error) {
      console.error("Error making API call:", error);
      throw error;
    }
  }
}
