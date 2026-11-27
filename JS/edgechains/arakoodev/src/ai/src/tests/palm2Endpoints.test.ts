import axios from 'axios'
import { Palm2AI } from '../lib/palm2/palm2'

jest.mock('axios')
const mockedAxios = axios as jest.Mocked<typeof axios>

describe('Palm2AI Google PaLM 2 Provider (#279)', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('should call PaLM 2 generateMessage endpoint for chat', async () => {
        mockedAxios.post.mockResolvedValueOnce({
            data: {
                candidates: [{ author: '1', content: 'Hello from PaLM 2 chat-bison-001!' }],
                messages: [{ author: 'user', content: 'Hi PaLM 2' }],
            },
        } as any)

        const palm = new Palm2AI({ apiKey: 'test-palm-key' })
        const res = await palm.chat({ prompt: 'Hi PaLM 2', temperature: 0.5 })

        expect(mockedAxios.post).toHaveBeenCalledTimes(1)
        expect(res.candidates[0].content).toBe('Hello from PaLM 2 chat-bison-001!')
    })

    it('should call PaLM 2 generateText endpoint for text completion', async () => {
        mockedAxios.post.mockResolvedValueOnce({
            data: {
                candidates: [{ output: 'Generated text from text-bison-001' }],
            },
        } as any)

        const palm = new Palm2AI({ apiKey: 'test-palm-key' })
        const res = await palm.generateText({
            prompt: 'Explain EdgeChains in one sentence',
            maxOutputTokens: 256,
        })

        expect(mockedAxios.post).toHaveBeenCalledTimes(1)
        expect(res.candidates[0].output).toBe('Generated text from text-bison-001')
    })

    it('should call PaLM 2 embedText endpoint for embeddings', async () => {
        mockedAxios.post.mockResolvedValueOnce({
            data: {
                embedding: { value: [0.12, -0.34, 0.56, 0.78] },
            },
        } as any)

        const palm = new Palm2AI({ apiKey: 'test-palm-key' })
        const embedding = await palm.generateEmbeddings({ text: 'EdgeChains vector embedding' })

        expect(mockedAxios.post).toHaveBeenCalledTimes(1)
        expect(embedding.value).toEqual([0.12, -0.34, 0.56, 0.78])
    })
})
