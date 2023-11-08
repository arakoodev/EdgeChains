import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import * as querystring from 'querystring';
import { ArkRequest } from './types/ArkRequest';
import { hydeSearchAdaEmbedding } from './service/HydeSearchService';
import { HydeUI } from './components/HydeUI';
import DatabaseConnection from './config/db';

DatabaseConnection.establishDatabaseConnection();

const app = new Hono();

app.get('/hyde-search/query-rrf', (c) => {
  return c.html(<HydeUI />);
})

app.post('/hyde-search/query-rrf', async (c) => {
    const encodedData = await c.req.text();
    const decodedData = querystring.unescape(encodedData);;
    const index = decodedData.indexOf("jsonData="); 
    const jsonString = decodedData.substring(index + "jsonData=".length); 
    const jsonData: ArkRequest = JSON.parse(jsonString);
    const arkRequest = {
        topK: parseInt(c.req.query('topK')?? "5"),
        metadataTable: jsonData.metadataTable,
        query: jsonData.query,
        textWeight: jsonData.textWeight,
        similarityWeight: jsonData.similarityWeight,
        dateWeight: jsonData.dateWeight,
        orderRRF: jsonData.orderRRF,
      };
    const answer = await hydeSearchAdaEmbedding(arkRequest);
    return c.text(answer.finalAnswer);
})

serve(app)
