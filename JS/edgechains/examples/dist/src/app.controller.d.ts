import { AppService } from './app.service';
export declare class AppController {
    private readonly appService;
    constructor(appService: AppService);
    getHello(): string;
    hydeSearch(params: any, query: any): Promise<{
        wordEmbeddings: any;
        finalAnswer: any;
    }>;
    testGenerator(): Promise<void>;
}
