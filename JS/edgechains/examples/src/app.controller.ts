import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  Render,
} from '@nestjs/common';
import { AppService } from './app.service';
import { hydeSearchAdaEmbedding } from './hydeExample/hydeExample';
import { getContent } from './testGeneration/TestGenerator';

@Controller()
export class AppController {
    constructor(private readonly appService: AppService) {}

    @Get()
    getHello(): string {
        return this.appService.getHello();
    }

  @Post('/hyde-search/query-rrf')
  @HttpCode(200)
  async hydeSearch(@Query() params: any, @Body() query: any) {
    const jsonData = JSON.parse(query.jsonData);
    const arkRequest = {
      topK: params.topK,
      metadataTable: jsonData.metadataTable,
      query: jsonData.query,
      textWeight: jsonData.textWeight,
      similarityWeight: jsonData.similarityWeight,
      dateWeight: jsonData.dateWeight,
      orderRRF: jsonData.orderRRF,
    };
    const result = await hydeSearchAdaEmbedding(arkRequest);
    return result.finalAnswer;
  }

  @Get('/hyde-search/query-rrf')
  @Render('hyde-search')
  root() {
    return {
      result: '',
    };
  }


   @Post('/testcase/generate')
   @HttpCode(200)
   testGenerator(){
       return getContent();
   }
}
