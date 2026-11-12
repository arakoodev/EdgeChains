import { Qdrant } from '../../lib/qdrant/qdrant'

const MOCK_QDRANT_URL = 'http://localhost:6333'
const MOCK_QDRANT_KEY = 'mock-qdrant-api-key'

describe('Qdrant Vector Database REST Wrapper (#273)', () => {
    it('should create a collection, upsert points, search, get by id, update payload, and delete points via direct REST calls', async () => {
        const qdrant = new Qdrant(MOCK_QDRANT_URL, MOCK_QDRANT_KEY)
        const mockClient: any = {
            put: jest.fn().mockImplementation(async (url: string, body: any) => {
                if (url.includes('/points')) {
                    return {
                        data: {
                            status: 'ok',
                            result: { operation_id: 1, status: 'completed' },
                            pointsCount: body.points.length,
                        },
                    }
                }
                return { data: { status: 'ok', result: true } }
            }),
            post: jest.fn().mockImplementation(async (url: string, body: any) => {
                if (url.endsWith('/points/search')) {
                    return {
                        data: {
                            status: 'ok',
                            result: [
                                {
                                    id: 1,
                                    score: 0.99,
                                    payload: { content: 'hello qdrant' },
                                },
                            ],
                        },
                    }
                }
                return { data: { status: 'ok', result: { status: 'completed' }, body } }
            }),
            get: jest.fn().mockResolvedValue({
                data: {
                    status: 'ok',
                    result: { id: 1, payload: { content: 'hello qdrant' } },
                },
            }),
            delete: jest.fn().mockResolvedValue({
                data: { status: 'ok', result: true },
            }),
        }

        const createRes = await qdrant.createCollection({
            client: mockClient,
            collectionName: 'test_collection',
            vectorSize: 4,
            distance: 'Cosine',
        })
        expect(createRes.status).toBe('ok')

        const insertRes = await qdrant.insertVectorData({
            client: mockClient,
            collectionName: 'test_collection',
            points: [{ id: 1, vector: [0.1, 0.2, 0.3, 0.4], payload: { content: 'hello qdrant' } }],
        })
        expect(insertRes.status).toBe('ok')

        const searchRes = await qdrant.getDataFromQuery({
            client: mockClient,
            collectionName: 'test_collection',
            vector: [0.1, 0.2, 0.3, 0.4],
            limit: 5,
        })
        expect(searchRes).toHaveLength(1)
        expect(searchRes[0].payload.content).toBe('hello qdrant')

        const pointRes = await qdrant.getDataById({
            client: mockClient,
            collectionName: 'test_collection',
            id: 1,
        })
        expect(pointRes.id).toBe(1)

        const updateRes = await qdrant.updateById({
            client: mockClient,
            collectionName: 'test_collection',
            id: 1,
            updatedContent: { content: 'updated qdrant' },
        })
        expect(updateRes.status).toBe('ok')

        const deleteRes = await qdrant.deleteById({
            client: mockClient,
            collectionName: 'test_collection',
            id: 1,
        })
        expect(deleteRes.status).toBe('ok')
    })
})
