import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { AppService } from './app.service';
import { hydeSearchAdaEmbedding } from './hydeExample/hydeExample';


@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    hydeSearchAdaEmbedding("hello");
    return this.appService.getHello();
  }

  @Post("/hyde-search")
  hydeSearch(@Query() params:any, @Body() query:string){
    const arkRequest = {
      tableName : params.table,
      nameSpace : params.namespace,
      query : query,
      topK : params.topK
    }
    hydeSearchAdaEmbedding(arkRequest);

  }
}
