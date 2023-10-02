import axios from 'axios';
import { Jsonnet } from "@hanazuki/node-jsonnet";
import * as path from 'path';
import { createConnection,getManager } from 'typeorm';


enum PostgresDistanceMetric {
  COSINE = 'COSINE',
  IP = 'IP',
  L2 = 'L2'
}

enum OrderRRFBy {
  TEXT_RANK = 'TEXT_RANK',
  SIMILARITY = 'SIMILARITY',
  DATE_RANK = 'DATE_RANK',
  DEFAULT = 'DEFAULT'
}

const gpt3endpoint = {
  url: "https://api.openai.com/v1/chat/completions",
  apikey : "",
  orgId : "",
  model : "gpt-3.5-turbo",
  role : "user",
  temprature : 0.7
}

export async function hydeSearchAdaEmbedding(arkRequest){
  try {
    // Get required params from API...
    const table = 'ada_hyde_prod';
    const namespace = '360_docs';
    const query = arkRequest.query;
    const topK = Number(arkRequest.topK);

    //
    const jsonnet = new Jsonnet();

    const promptPath = path.join(process.cwd(),'./src/hydeExample/prompts.jsonnet')
    const hydePath = path.join(process.cwd(),'./src/hydeExample/hyde.jsonnet')
    // Load Jsonnet to extract args..
    var promptLoader = await jsonnet
                            .evaluateFile(promptPath);

    // Getting ${summary} basePrompt
    const promptTemplate = JSON.parse(promptLoader).summary;

    // Getting the updated promptTemplate with query
    var hydeLoader = await jsonnet
                        .extString('promptTemplate',promptTemplate)
                        .extString('time',"")
                        .extString('query',query)
                        .evaluateFile(hydePath);

    // Get concatenated prompt
    const prompt = JSON.parse(hydeLoader).prompt;

    // Block and get the response from GPT3
    const gptResponse = await gptFn(prompt);

    // Chain 1 ==> Get Gpt3Response & split
    const gpt3Responses = gptResponse.split('\n');

    // Chain 2 ==> Get Embeddings from OpenAI using Each Response
    const embeddingsListChain: Promise<Number[][]> = Promise.all(
      gpt3Responses.map(async (resp) => {
        const embedding = await embeddings(resp);
        return embedding;
      })
    );
    // // Chain 4 ==> Calculate Mean from EmbeddingList & Pass to WordEmbedding Object
    const meanEmbedding = await meanFn(await embeddingsListChain, 1536);
    const wordEmbeddings = {
      id : gptResponse,
      score : meanEmbedding
    }

    // // Chain 5 ==> Query via EmbeddingChain
    const queryResult = await dbQuery(wordEmbeddings, PostgresDistanceMetric.IP, topK, 20,table,namespace,arkRequest,15);

    // // Chain 6 ==> Create Prompt using Embeddings
    const retrievedDocs: string[] = [];

    for (const embeddings of queryResult) {
      retrievedDocs.push(
        `${embeddings.raw_text}\n score:${embeddings.score}\n filename:${embeddings.filename}\n`
      );
    }
  
    if (retrievedDocs.join('').length > 4096) {
      retrievedDocs.length = 4096;
    }

    const currentTime = new Date().toLocaleString();
    const formattedTime = currentTime;

    // System prompt
    const ansPromptSystem = JSON.parse(promptLoader).ans_prompt_system 
    
    hydeLoader = await jsonnet
                            .extString(promptTemplate,ansPromptSystem)
                            .extString('time',formattedTime)
                            .extString('qeury',retrievedDocs.join(''))
                            .evaluateFile(hydePath);

    const finalPromptSystem = JSON.parse(hydeLoader).prompt;

    // User prompt
    const ansPromptUser = JSON.parse(promptLoader).ans_prompt_user
    
    hydeLoader = await jsonnet
                            .extString(promptTemplate,ansPromptUser)
                            .extString('qeury',query)
                            .evaluateFile(hydePath);
    const finalPromptUser = JSON.parse(hydeLoader).prompt;;

    const chatMessages = [
      { 'role': 'system', 'content': finalPromptSystem },
      { 'role': 'user', 'content': finalPromptUser },
    ];

    const finalAnswer = await gptFnChat(chatMessages);

    const response = {
      wordEmbeddings: queryResult,
      finalAnswer: finalAnswer,
    };

    return response;
  } catch (error) {
    // Handle errors here
    console.error(error);
    throw error;
  }
}

async function  gptFn(prompt:string) : Promise<string>{

    const responce = await axios.post('https://api.openai.com/v1/chat/completions', {
      'model' : gpt3endpoint.model,
      'messages' : [{
        'role' : gpt3endpoint.role,
        'content' : prompt
      }],
      'temperature' : gpt3endpoint.temprature
    },{
      headers : {
        Authorization : 'Bearer ' + gpt3endpoint.apikey ,
        'content-type' : 'application/json'
      }
    })
    .then(function(response){
      return response.data.choices
    }
      
    )
    .catch(function (error) {
      if (error.response) {
        console.log('Server responded with status code:', error.response.status);
        console.log('Response data:', error.response.data);
      } else if (error.request) {
        console.log('No response received:', error.request);
      } else {
        console.log('Error creating request:', error.message);
      }
    });
    return responce[0].message.content;
}

async function gptFnChat(chatMessages) {
  const responce = await axios.post('https://api.openai.com/v1/chat/completions', {
    'model' : gpt3endpoint.model,
    'messages' : chatMessages,
    'temperature' : gpt3endpoint.temprature
  },{
    headers : {
      Authorization : 'Bearer ' + gpt3endpoint.apikey ,
      'content-type' : 'application/json'
    }
  })
  .then(function(response){
    return response.data.choices
  }
    
  )
  .catch(function (error) {
    if (error.response) {
      console.log('Server responded with status code:', error.response.status);
      console.log('Response data:', error.response.data);
    } else if (error.request) {
      console.log('No response received:', error.request);
    } else {
      console.log('Error creating request:', error.message);
    }
  });

  return responce[0].message.content;
}

async function embeddings(resp : string): Promise<Number[]> {
  const responce = await axios.post('https://api.openai.com/v1/embeddings', {
    "model" : "text-embedding-ada-002",
    "input" : resp
    },{
      headers : {
        Authorization : 'Bearer ' + gpt3endpoint.apikey ,
        'content-type' : 'application/json'
      }
    })
    .then(function(response){
      return response.data.data[0].embedding;
    }
      
    )
    .catch(function (error) {
      if (error.response) {
        console.log('Server responded with status code:', error.response.status);
        console.log('Response data:', error.response.data);
      } else if (error.request) {
        console.log('No response received:', error.request);
      } else {
        console.log('Error creating request:', error.message);
      }
    });

    return responce;
}

function meanFn(embeddingsList: Number[][], dimensions: number): Number[] {
  const mean: Number[] = [];

  for (let i = 0; i < dimensions; i++) {
    let sum = 0;

    for (let j = 0; j < embeddingsList.length; j++) {
      sum = sum.valueOf() + embeddingsList[j][i].valueOf();
    }

    mean.push(sum / embeddingsList.length);
  }
  return mean;
}


async function dbQuery(wordEmbeddings, metric, topK, probes, tableName, namespace:string, arkRequest: any, upperLimit) {
  const embedding = JSON.stringify(wordEmbeddings.score)
  await createConnection();
  const entityManager = getManager();
  try {
    const query1 = `SET LOCAL ivfflat.probes = ${probes};`
    await entityManager.query(query1);

    // const query = `SELECT id, raw_text, document_date, metadata, namespace, filename, timestamp,
    //   '${arkRequest.textWeight.baseWeight}' / (ROW_NUMBER() OVER (ORDER BY text_rank DESC) + '${arkRequest.textWeight.fineTuneWeight}') +
    //   '${arkRequest.similarityWeight.baseWeight}' / (ROW_NUMBER() OVER (ORDER BY similarity DESC) + '${arkRequest.similarityWeight.fineTuneWeight}') +
    //   '${arkRequest.dateWeight.baseWeight}' / (ROW_NUMBER() OVER (ORDER BY date_rank DESC) + '${arkRequest.dateWeight.fineTuneWeight}') AS rrf_score
    //   FROM ( SELECT sv.id, sv.raw_text, sv.namespace, sv.filename, sv.timestamp, svtm.document_date, svtm.metadata, ts_rank_cd(sv.tsv, plainto_tsquery('${'english'}', '${arkRequest.qeury}')) AS text_rank, 
    //   `;
    //   // (embedding <#> '${embedding}') * -1  AS score 
    //   // FROM ${tableName}
    //   // WHERE namespace = '${namespace}'
    //   // ORDER BY embedding <#> '${embedding}'
    //   // LIMIT ${topK};

    let query: string = '';

    // for (let i = 0; i < wordEmbeddings.score.length; i++) {
    //     const embeddings: string = JSON.stringify(wordEmbeddings.score[i]);

        query += `( SELECT id, raw_text, document_date, metadata, namespace, filename, timestamp, 
          ${arkRequest.textWeight.baseWeight} / (ROW_NUMBER() OVER (ORDER BY text_rank DESC) + ${arkRequest.textWeight.fineTuneWeight}) +
          ${arkRequest.similarityWeight.baseWeight} / (ROW_NUMBER() OVER (ORDER BY similarity DESC) + ${arkRequest.similarityWeight.fineTuneWeight}) +
          ${arkRequest.dateWeight.baseWeight} / (ROW_NUMBER() OVER (ORDER BY date_rank DESC) + ${arkRequest.dateWeight.fineTuneWeight}) AS rrf_score
          FROM ( SELECT sv.id, sv.raw_text, sv.namespace, sv.filename, sv.timestamp, svtm.document_date, svtm.metadata, ts_rank_cd(sv.tsv, plainto_tsquery('${'english'}', '${arkRequest.query}')) AS text_rank, `

        if(metric === PostgresDistanceMetric.COSINE)
          query += `1 - (sv.embedding <=> '${embedding}') AS similarity, `
        if(metric === PostgresDistanceMetric.IP)
          query += `(sv.embedding <#> '${embedding}') * -1 AS similarity, `
        if(metric === PostgresDistanceMetric.L2)
          query += `sv.embedding <-> '${embedding}' AS similarity, `

        query += `CASE WHEN svtm.document_date IS NULL THEN 0 ELSE EXTRACT(YEAR FROM svtm.document_date) * 365 + EXTRACT(DOY FROM svtm.document_date) END AS date_rank FROM (SELECT id, raw_text, embedding, tsv, namespace, filename, timestamp from ${tableName} WHERE namespace = '${namespace}'`
          
        if(metric === PostgresDistanceMetric.COSINE)
          query += ` ORDER BY embedding <=> '${embedding}'  LIMIT ${topK}`
        if(metric === PostgresDistanceMetric.IP)
          query += ` ORDER BY embedding <#> '${embedding}'  LIMIT ${topK}`
        if(metric === PostgresDistanceMetric.L2)
          query += ` ORDER BY embedding <-> '${embedding}'  LIMIT ${topK}`

        query += `) sv JOIN ${tableName}_join_${arkRequest.metadataTable} jtm ON sv.id = jtm.id JOIN ${tableName}_${arkRequest.metadataTable} svtm ON jtm.metadata_id = svtm.metadata_id) subquery `
        
        switch (arkRequest.orderRRF) {
          case 'text_rank':
            query += `ORDER BY text_rank DESC, rrf_score DESC`
            break;
          case 'similarity':
            query += `ORDER BY similarity DESC, rrf_score DESC`
            break;
          case 'date_rank':
            query += `ORDER BY date_rank DESC, rrf_score DESC`
            break;
          case 'default':
            query += `ORDER BY rrf_score DESC`
            break;
        }

        query += ` LIMIT ${topK})`
        // if (i < wordEmbeddings.score.length - 1) {
        //   query += ' UNION ALL \n';
        // }
        // query +=
        //     `(SELECT id, raw_text, document_date, metadata, namespace, filename, timestamp,
        //         ${arkRequest.textWeight.baseWeight} / (ROW_NUMBER() OVER (ORDER BY text_rank DESC) + ${arkRequest.textWeight.fineTuneWeight}) +
        //         ${arkRequest.similarityWeight.baseWeight} / (ROW_NUMBER() OVER (ORDER BY similarity DESC) + ${arkRequest.similarityWeight.fineTuneWeight}) +
        //         ${arkRequest.dateWeight.baseWeight} / (ROW_NUMBER() OVER (ORDER BY date_rank DESC) + ${arkRequest.dateWeight.fineTuneWeight}) AS rrf_score
        //     FROM (SELECT sv.id, sv.raw_text, sv.namespace, sv.filename, sv.timestamp,svtm.document_date, svtm.metadata,ts_rank_cd(sv.tsv, plainto_tsquery(${'english'}, ${arkRequest.query})) AS text_rank,CASE WHEN svtm.document_date IS NULL THEN 0
        //             ELSE EXTRACT(YEAR FROM svtm.document_date) * 365 + EXTRACT(DOY FROM svtm.document_date)
        //         END AS date_rank
        //         FROM ${tableName} sv
        //         JOIN ${tableName}_join_${arkRequest.metadataTable} jtm ON sv.id = jtm.id
        //         JOIN ${tableName}_${arkRequest.metadataTable} svtm ON jtm.metadata_id = svtm.metadata_id
        //         WHERE sv.namespace = ${namespace}
        //         ORDER BY 
        //             ${metric === PostgresDistanceMetric.COSINE ? 'embedding <=> ' :
        //               metric === PostgresDistanceMetric.IP ? 'embedding <#> ' :
        //               metric === PostgresDistanceMetric.L2 ? 'embedding <-> ' :
        //               ''}
        //             '${embeddings}' ${metric === PostgresDistanceMetric.IP ? '* -1' : ''}
        //         LIMIT ${topK}
        //     ) sv
        //     ) subquery \n`;

        // // Append UNION ALL for multiple sets of values
        // if (i < wordEmbeddings.score.length - 1) {
        //     query += ' UNION ALL \n';
        // }
    // }

    if (wordEmbeddings.score.length > 1) {
        query = `SELECT * FROM (SELECT DISTINCT ON (result.id) * FROM ( ${query} ) result) subquery ORDER BY rrf_score DESC LIMIT ${upperLimit};`;
    } else {
        query += ` ORDER BY rrf_score DESC LIMIT ${topK};`;
    }

    console.log(query)
    const results = await entityManager.query(query);
    console.log(results)
    return results;
  } catch (error) {
    // Handle errors here
    console.error(error);
    throw error;
  }
}
