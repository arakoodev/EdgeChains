"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenAiEndpoint = void 0;
const axios_1 = require("axios");
class OpenAiEndpoint {
    constructor(url, apiKey, orgId, model, role, temprature) {
        this.url = url;
        this.apiKey = apiKey;
        this.orgId = orgId;
        this.model = model;
        this.role = role;
        this.temprature = temprature;
    }
    async gptFn(prompt) {
        const responce = await axios_1.default
            .post('https://api.openai.com/v1/chat/completions', {
            model: this.model,
            messages: [
                {
                    role: this.role,
                    content: prompt,
                },
            ],
            temperature: this.temprature,
        }, {
            headers: {
                Authorization: 'Bearer ' + this.apiKey,
                'content-type': 'application/json',
            },
        })
            .then(function (response) {
            return response.data.choices;
        })
            .catch(function (error) {
            if (error.response) {
                console.log('Server responded with status code:', error.response.status);
                console.log('Response data:', error.response.data);
            }
            else if (error.request) {
                console.log('No response received:', error.request);
            }
            else {
                console.log('Error creating request:', error.message);
            }
        });
        return responce[0].message.content;
    }
    async embeddings(resp) {
        const responce = await axios_1.default
            .post('https://api.openai.com/v1/embeddings', {
            model: 'text-embedding-ada-002',
            input: resp,
        }, {
            headers: {
                Authorization: 'Bearer ' + this.apiKey,
                'content-type': 'application/json',
            },
        })
            .then(function (response) {
            return response.data.data[0].embedding;
        })
            .catch(function (error) {
            if (error.response) {
                console.log('Server responded with status code:', error.response.status);
                console.log('Response data:', error.response.data);
            }
            else if (error.request) {
                console.log('No response received:', error.request);
            }
            else {
                console.log('Error creating request:', error.message);
            }
        });
        return responce;
    }
    async gptFnChat(chatMessages) {
        const responce = await axios_1.default
            .post('https://api.openai.com/v1/chat/completions', {
            model: this.model,
            messages: chatMessages,
            temperature: this.temprature,
        }, {
            headers: {
                Authorization: 'Bearer ' + this.apiKey,
                'content-type': 'application/json',
            },
        })
            .then(function (response) {
            return response.data.choices;
        })
            .catch(function (error) {
            if (error.response) {
                console.log('Server responded with status code:', error.response.status);
                console.log('Response data:', error.response.data);
            }
            else if (error.request) {
                console.log('No response received:', error.request);
            }
            else {
                console.log('Error creating request:', error.message);
            }
        });
        return responce[0].message.content;
    }
    async gptFnTestGenerator(prompt) {
        const responce = await axios_1.default
            .post('https://api.openai.com/v1/chat/completions', {
            model: this.model,
            messages: [
                {
                    role: this.role,
                    content: prompt,
                },
            ],
            temperature: this.temprature,
        }, {
            headers: {
                Authorization: 'Bearer ' + this.apiKey,
                'content-type': 'application/json',
            },
        })
            .then(function (response) {
            return response.data.choices;
        })
            .catch(function (error) {
            if (error.response) {
                console.log('Server responded with status code:', error.response.status);
                console.log('Response data:', error.response.data);
            }
            else if (error.request) {
                console.log('No response received:', error.request);
            }
            else {
                console.log('Error creating request:', error.message);
            }
        });
        return responce[0].message.content;
    }
}
exports.OpenAiEndpoint = OpenAiEndpoint;
//# sourceMappingURL=OpenAiEndpoint.js.map