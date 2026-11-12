import axios from 'axios'
import { retry } from '@lifeomic/attempt'

const PALM_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta2/models'

export interface Palm2ConstructionOptions {
    apiKey?: string
}

export interface Palm2Message {
    author?: string
    content: string
}

export interface Palm2ChatOptions {
    model?: string
    prompt?: string
    messages?: Palm2Message[]
    context?: string
    temperature?: number
    candidateCount?: number
    topP?: number
    topK?: number
    max_retry?: number
    delay?: number
}

export interface Palm2TextOptions {
    model?: string
    prompt: string
    temperature?: number
    maxOutputTokens?: number
    candidateCount?: number
    topP?: number
    topK?: number
    max_retry?: number
    delay?: number
}

export interface Palm2EmbeddingOptions {
    model?: string
    text: string
    max_retry?: number
    delay?: number
}

export class Palm2AI {
    apiKey: string

    constructor(options: Palm2ConstructionOptions = {}) {
        this.apiKey =
            options.apiKey ||
            process.env.PALM_API_KEY ||
            process.env.GOOGLE_API_KEY ||
            ''
    }

    async chat(chatOptions: Palm2ChatOptions): Promise<any> {
        const model = chatOptions.model || 'chat-bison-001'
        const endpoint = `${PALM_BASE_URL}/${model}:generateMessage?key=${encodeURIComponent(this.apiKey)}`

        const messages: Palm2Message[] =
            chatOptions.messages && chatOptions.messages.length > 0
                ? chatOptions.messages
                : [{ author: 'user', content: chatOptions.prompt || '' }]

        const payload = {
            prompt: {
                context: chatOptions.context || '',
                messages,
            },
            temperature: chatOptions.temperature ?? 0.7,
            candidateCount: chatOptions.candidateCount ?? 1,
            ...(chatOptions.topP !== undefined ? { topP: chatOptions.topP } : {}),
            ...(chatOptions.topK !== undefined ? { topK: chatOptions.topK } : {}),
        }

        return await retry(
            async () => {
                const res = await axios.post(endpoint, payload, {
                    headers: { 'Content-Type': 'application/json' },
                })
                return res.data
            },
            { maxAttempts: chatOptions.max_retry || 3, delay: chatOptions.delay || 200 }
        )
    }

    async generateText(textOptions: Palm2TextOptions): Promise<any> {
        const model = textOptions.model || 'text-bison-001'
        const endpoint = `${PALM_BASE_URL}/${model}:generateText?key=${encodeURIComponent(this.apiKey)}`

        const payload = {
            prompt: {
                text: textOptions.prompt,
            },
            temperature: textOptions.temperature ?? 0.7,
            maxOutputTokens: textOptions.maxOutputTokens ?? 1024,
            candidateCount: textOptions.candidateCount ?? 1,
            ...(textOptions.topP !== undefined ? { topP: textOptions.topP } : {}),
            ...(textOptions.topK !== undefined ? { topK: textOptions.topK } : {}),
        }

        return await retry(
            async () => {
                const res = await axios.post(endpoint, payload, {
                    headers: { 'Content-Type': 'application/json' },
                })
                return res.data
            },
            { maxAttempts: textOptions.max_retry || 3, delay: textOptions.delay || 200 }
        )
    }

    async generateEmbeddings(embeddingOptions: Palm2EmbeddingOptions): Promise<any> {
        const model = embeddingOptions.model || 'embedding-gecko-001'
        const endpoint = `${PALM_BASE_URL}/${model}:embedText?key=${encodeURIComponent(this.apiKey)}`

        const payload = {
            text: embeddingOptions.text,
        }

        return await retry(
            async () => {
                const res = await axios.post(endpoint, payload, {
                    headers: { 'Content-Type': 'application/json' },
                })
                return res.data?.embedding ?? res.data
            },
            {
                maxAttempts: embeddingOptions.max_retry || 3,
                delay: embeddingOptions.delay || 200,
            }
        )
    }
}
