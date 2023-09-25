import axios from 'axios';
import { Jsonnet } from "@hanazuki/node-jsonnet";
import * as path from 'path';
import { createConnection,getManager } from 'typeorm';


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
    const table = arkRequest.tableName;
    const namespace = arkRequest.nameSpace;
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
    console.log(promptTemplate);

    // // Getting the updated promptTemplate with query
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
        const embedding = await embeddings(resp, arkRequest);
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
    const queryResult = await dbQuery(wordEmbeddings, "<=>", topK, 20,table,namespace);

    // // Chain 6 ==> Create Prompt using Embeddings
    const retrievedDocs: string[] = [];

    for (const embeddings of queryResult) {
      retrievedDocs.push(
        `${embeddings.getRawText()}\n score:${embeddings.getScore()}\n filename:${embeddings.getFilename()}\n`
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
      { 'sender': 'system', 'message': finalPromptSystem },
      { 'sender': 'user', 'message': finalPromptUser },
    ];

    const finalAnswer = await gptFnChat(chatMessages, arkRequest);

    const response = {
      wordEmbeddings: queryResult,
      finalAnswer: finalAnswer,
    };

    // return response;
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
        Authorization : 'Bearer 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' ,
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

async function gptFnChat(chatMessages,arkRequest) {
  const responce = await axios.post('https://api.openai.com/v1/chat/completions', {
    'model' : gpt3endpoint.model,
    'messages' : chatMessages,
    'temperature' : gpt3endpoint.temprature
  },{
    headers : {
      Authorization : 'Bearer ' + gpt3Endpoint.apikey ,
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
}

async function embeddings(resp : string, arkRequest): Promise<Number[]> {
  const responce = await axios.post('https://api.openai.com/v1/embeddings', {
    "model" : "text-embedding-ada-002",
    "input" : resp
    },{
      headers : {
        Authorization : 'Bearer ' + gpt3Endpoint.apikey ,
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


async function dbQuery(wordEmbeddings, metric, topK, probes,tableName,namespace:string) {
  const embedding = JSON.stringify(wordEmbeddings.score)
  console.log(embedding)
  
  const connection = await createConnection();
  const entityManager = getManager();
  try {
    const query1 = `SET LOCAL ivfflat.probes = ${probes};`
    await entityManager.query(query1);

    const query = `
      SELECT id, raw_text, namespace, filename, timestamp, 
      1 - (embedding <=> "${embedding.toString()}")  AS score 
      FROM ${tableName}
      WHERE namespace = '${namespace}'
      ORDER BY embedding ${metric} ${embedding}
      LIMIT ${topK};
    `;

    const results = await entityManager.query(query);
    console.log(results)
    return results;
  } catch (error) {
    // Handle errors here
    console.error(error);
    throw error;
  }
}
