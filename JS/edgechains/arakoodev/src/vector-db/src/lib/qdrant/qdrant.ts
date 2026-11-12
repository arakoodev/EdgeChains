import axios, { AxiosInstance } from 'axios'
import retry from 'retry'
import { config } from 'dotenv'
config()

export interface QdrantPoint {
    id: string | number
    vector: number[]
    payload?: Record<string, any>
}

export interface CreateCollectionArgs {
    client?: AxiosInstance
    collectionName: string
    vectorSize: number
    distance?: 'Cosine' | 'Euclid' | 'Dot' | 'Manhattan'
}

export interface InsertVectorDataArgs {
    client?: AxiosInstance
    collectionName: string
    points: QdrantPoint[]
    wait?: boolean
}

export interface SearchVectorQueryArgs {
    client?: AxiosInstance
    collectionName: string
    vector: number[]
    limit?: number
    scoreThreshold?: number
    filter?: Record<string, any>
    withPayload?: boolean
    withVector?: boolean
}

export class Qdrant {
    QDRANT_URL: string
    QDRANT_API_KEY: string

    constructor(QDRANT_URL?: string, QDRANT_API_KEY?: string) {
        this.QDRANT_URL = (
            QDRANT_URL ||
            process.env.QDRANT_URL ||
            'http://localhost:6333'
        ).replace(/\/+$/, '')
        this.QDRANT_API_KEY = QDRANT_API_KEY || process.env.QDRANT_API_KEY || ''
    }

    createClient(): AxiosInstance {
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        }
        if (this.QDRANT_API_KEY) {
            headers['api-key'] = this.QDRANT_API_KEY
        }
        return axios.create({
            baseURL: this.QDRANT_URL,
            headers,
        })
    }

    async createCollection({
        client,
        collectionName,
        vectorSize,
        distance = 'Cosine',
    }: CreateCollectionArgs): Promise<any> {
        const http = client || this.createClient()
        const res = await http.put(`/collections/${encodeURIComponent(collectionName)}`, {
            vectors: {
                size: vectorSize,
                distance,
            },
        })
        return res.data
    }

    async getCollection({
        client,
        collectionName,
    }: {
        client?: AxiosInstance
        collectionName: string
    }): Promise<any> {
        const http = client || this.createClient()
        const res = await http.get(`/collections/${encodeURIComponent(collectionName)}`)
        return res.data
    }

    async deleteCollection({
        client,
        collectionName,
    }: {
        client?: AxiosInstance
        collectionName: string
    }): Promise<any> {
        const http = client || this.createClient()
        const res = await http.delete(`/collections/${encodeURIComponent(collectionName)}`)
        return res.data
    }

    async insertVectorData({
        client,
        collectionName,
        points,
        wait = true,
    }: InsertVectorDataArgs): Promise<any> {
        const http = client || this.createClient()
        return new Promise((resolve, reject) => {
            const operation = retry.operation({
                retries: 3,
                factor: 2,
                minTimeout: 500,
                maxTimeout: 5000,
                randomize: true,
            })

            operation.attempt(async () => {
                try {
                    const res = await http.put(
                        `/collections/${encodeURIComponent(collectionName)}/points?wait=${wait ? 'true' : 'false'}`,
                        { points }
                    )
                    resolve(res.data)
                } catch (error: any) {
                    if (operation.retry(error)) {
                        return
                    }
                    reject(error)
                }
            })
        })
    }

    async getDataFromQuery({
        client,
        collectionName,
        vector,
        limit = 10,
        scoreThreshold,
        filter,
        withPayload = true,
        withVector = false,
    }: SearchVectorQueryArgs): Promise<any> {
        const http = client || this.createClient()
        return new Promise((resolve, reject) => {
            const operation = retry.operation({
                retries: 3,
                factor: 2,
                minTimeout: 500,
                maxTimeout: 5000,
                randomize: true,
            })

            operation.attempt(async () => {
                try {
                    const body: Record<string, any> = {
                        vector,
                        limit,
                        with_payload: withPayload,
                        with_vector: withVector,
                    }
                    if (scoreThreshold !== undefined) {
                        body.score_threshold = scoreThreshold
                    }
                    if (filter) {
                        body.filter = filter
                    }
                    const res = await http.post(
                        `/collections/${encodeURIComponent(collectionName)}/points/search`,
                        body
                    )
                    resolve(res.data?.result ?? res.data)
                } catch (error: any) {
                    if (operation.retry(error)) {
                        return
                    }
                    reject(error)
                }
            })
        })
    }

    async getData({
        client,
        collectionName,
        limit = 100,
        offset,
        withPayload = true,
        withVector = false,
    }: {
        client?: AxiosInstance
        collectionName: string
        limit?: number
        offset?: string | number
        withPayload?: boolean
        withVector?: boolean
    }): Promise<any> {
        const http = client || this.createClient()
        const body: Record<string, any> = {
            limit,
            with_payload: withPayload,
            with_vector: withVector,
        }
        if (offset !== undefined) {
            body.offset = offset
        }
        const res = await http.post(
            `/collections/${encodeURIComponent(collectionName)}/points/scroll`,
            body
        )
        return res.data?.result ?? res.data
    }

    async getDataById({
        client,
        collectionName,
        id,
    }: {
        client?: AxiosInstance
        collectionName: string
        id: string | number
    }): Promise<any> {
        const http = client || this.createClient()
        const res = await http.get(
            `/collections/${encodeURIComponent(collectionName)}/points/${encodeURIComponent(String(id))}`
        )
        return res.data?.result ?? res.data
    }

    async updateById({
        client,
        collectionName,
        id,
        updatedContent,
        wait = true,
    }: {
        client?: AxiosInstance
        collectionName: string
        id: string | number
        updatedContent: Record<string, any>
        wait?: boolean
    }): Promise<any> {
        const http = client || this.createClient()
        const res = await http.post(
            `/collections/${encodeURIComponent(collectionName)}/points/payload?wait=${wait ? 'true' : 'false'}`,
            {
                payload: updatedContent,
                points: [id],
            }
        )
        return res.data
    }

    async deleteById({
        client,
        collectionName,
        id,
        wait = true,
    }: {
        client?: AxiosInstance
        collectionName: string
        id: string | number | Array<string | number>
        wait?: boolean
    }): Promise<any> {
        const http = client || this.createClient()
        const points = Array.isArray(id) ? id : [id]
        const res = await http.post(
            `/collections/${encodeURIComponent(collectionName)}/points/delete?wait=${wait ? 'true' : 'false'}`,
            { points }
        )
        return res.data
    }
}
