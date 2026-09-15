import axios from 'axios';

const baseUrl = "https://api.tavily.com"
interface TavilyConstructionOptions {
    apiKey?: string;
}

interface TavilySearchOptions {
    query: string;
    include_answer?: boolean;
    include_images?: boolean;
    include_image_descriptions?: boolean;
    include_raw_content?: boolean;
    max_results?:number;
    include_domains?: string[];
    exclude_domains?: string[];
    // search_depth?: string;
}

interface SearchResult {
    title: string;
    url: string;
    content: string;
    score: number;
    raw_content: string | null;
}

interface SearchResponse {
    query: string;
    follow_up_questions: string | null;
    answer: string | null;
    images: string[];
    results: SearchResult[];
    response_time: number;
}

interface ExtractResponse {
    results: {
        url: string;
        raw_content: string;
    }[];
    failed_results: any[];
    response_time: number;
}

export class Tavily{
    apiKey: string;
    constructor(options: TavilyConstructionOptions) {
        
        this.apiKey = options.apiKey || process.env.TAVILY_API_KEY || "";
    }

    async search(searchOptions: TavilySearchOptions): Promise<SearchResponse> {
        if (!this.apiKey) {
            throw new Error("API key is required. Provide it via options or the TAVILY_API_KEY environment variable.");
        }
        
        let data = {
            api_key: this.apiKey,
            query: searchOptions.query,
            search_depth:"basic",
            include_answer: searchOptions.include_answer||false,
            include_images: searchOptions.include_images||false,
            include_image_descriptions: searchOptions.include_images||false,
            include_raw_content: searchOptions.include_raw_content||false,
            max_results: searchOptions.max_results||5,
            include_domains: searchOptions.include_domains||[],
            exclude_domains: searchOptions.exclude_domains||[]
        };
        let config = {
            method: "post",
            maxBodyLength: Infinity,
            url: baseUrl+"/search",
            headers: {
                "Content-Type": "application/json",
            },
            data: data,
            timout: 10000
        };
        try {
            const response = await axios(config);
            return response.data as SearchResponse;
        } catch (error) {
            console.error("Error making request:", error);
            throw error;
        }

    }

    async extract(urls: string[]): Promise<ExtractResponse> {
        if (!this.apiKey) {
            throw new Error("API key is required. Provide it via options or the TAVILY_API_KEY environment variable.");
        }
        let data = {
            api_key: this.apiKey,
            urls: urls
        };
        let config = {
            method: "post",
            maxBodyLength: Infinity,
            url: baseUrl + "/extract",
            headers: {
                "Content-Type": "application/json",
            },
            data: data,
            timout: 10000
        };
        try {
            const response = await axios(config);
            return response.data as ExtractResponse;
        } catch (error) {
            console.error("Error making request:", error);
            throw error;
        }
    }
}