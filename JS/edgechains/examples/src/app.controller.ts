import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { AppService } from './app.service';
import { hydeSearchAdaEmbedding } from './hydeExample/hydeExample';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Post('/hyde-search/query-rrf')
  @HttpCode(200)
  hydeSearch(@Query() params: any, @Body() query: any) {
    const arkRequest = {
      topK: params.topK,
      metadataTable: query.metadataTable,
      query: query.query,
      textWeight: query.textWeight,
      similarityWeight: query.similarityWeight,
      dateWeight: query.dateWeight,
      orderRRF: query.orderRRF,
    };
    return hydeSearchAdaEmbedding(arkRequest);
  }
}
