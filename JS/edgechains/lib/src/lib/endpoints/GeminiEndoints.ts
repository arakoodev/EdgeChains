import axios from 'axios';

export class GeminiAPI {
   apiKey: string;
   baseUrl: string;

  constructor(
    apiKey: string,
    baseUrl: string = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro'
  ) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  async generateContent(text: string): Promise<any> {
    const url = `${this.baseUrl}:generateContent?key=${this.apiKey}`;
    const requestBody = {
      contents: [
        {
          parts: [
            {
              text: text,
            },
          ],
        },
      ],
    };

    try {
      const response = await axios.post(url, requestBody, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return response.data.candidates[0].content.parts[0].text; 
    } catch (error: any) {
      throw new Error(`Error in generating content: ${error.message}`);
    }
  }
}