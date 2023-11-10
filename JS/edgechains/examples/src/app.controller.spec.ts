import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
    let appController: AppController;

    beforeEach(async () => {
        const app: TestingModule = await Test.createTestingModule({
            controllers: [AppController],
            providers: [AppService],
        }).compile();

        appController = app.get<AppController>(AppController);
    });

    describe('root', () => {
        it('should return "Hello World!"', () => {
            expect(appController.getHello()).toBe('Hello World!');
        });
    });
    describe('POST /hyde-search/query-rrf', () => {
        it('for querying top 5 programming languages the response should contain Java', async () => {
            const params = {
                topK: 5,
            };
            const query = {
                metadataTable: 'title_metadata',
                query: 'tell me the top 5 programming languages currently',
                textWeight: {
                    baseWeight: '1.0',
                    fineTuneWeight: '0.35',
                },
                similarityWeight: {
                    baseWeight: '1.5',
                    fineTuneWeight: '0.40',
                },
                dateWeight: {
                    baseWeight: '1.25',
                    fineTuneWeight: '0.75',
                },
                orderRRF: 'default',
            };
            expect((await appController.hydeSearch(params, query)).finalAnswer).toContain('Java');
        }, 12000);
    });
});
