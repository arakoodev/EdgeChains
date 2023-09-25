import axios from 'axios';
import { Jsonnet } from "@hanazuki/node-jsonnet";
import { error } from 'console';

interface WordEmbeddings {
  // Define the properties of WordEmbeddings here
}

interface PostgresWordEmbeddings {
  // Define the properties of PostgresWordEmbeddings here
}


interface ChatMessage {
  // Define the properties and methods of ChatMessage here
}


const gpt3endpoint = {
  url: "https://api.openai.com/v1/chat/completions",
  apikey : "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",
  orgId : "org-ha7bPSLcoUnYzUMZ5xAogTgo",
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

    // Configure PostgresEndpoint
    const postgresEndpoint = {
      tableName: table,
      namespace: namespace,
      // Add other properties here...
    };

    // Load Jsonnet to extract args..
    // const promptLoader = await jsonnet
    //                         .evaluateFile('./hyde.jsonnet');

    // // Getting ${summary} basePrompt
    // const promptTemplate = JSON.parse(promptLoader).summary;
    // console.log(promptTemplate);

    // // Getting the updated promptTemplate with query
    // const hydeLoader = await jsonnet
    //                     .extString('promptTemplate',promptTemplate)
    //                     .extString('time',"")
    //                     .extString('query',query)
    //                     .evaluateFile("./hyde.jsonnet");

    // Get concatenated prompt
    const prompt = "Do not expand on abbreviations and leave them as is in the reply. Please generate 5 different responses in bullet points for the question.Please write a summary to answer the question in detail:\nQuestion: Hello How are You\nPassage:"
    console.log(prompt);

    // Block and get the response from GPT3
    const gptResponse = await gptFn(prompt, arkRequest);

    // Chain 1 ==> Get Gpt3Response & split
    const gpt3Responses = gptResponse.split('\n');

    // Chain 2 ==> Get Embeddings from OpenAI using Each Response
    // const embeddingsListChain: Promise<number[][]> = Promise.all(
    //   gpt3Responses.map(async (resp) => {
    //     const embeddings = await ada002Embedding.embeddings(resp, arkRequest);
    //     return embeddings.getValues();
    //   })
    // );

    // // Chain 4 ==> Calculate Mean from EmbeddingList & Pass to WordEmbedding Object
    // const meanEmbedding = await meanFn(await embeddingsListChain, 1536);
    // const wordEmbeddings = new WordEmbeddings(gptResponse, meanEmbedding);

    // // Chain 5 ==> Query via EmbeddingChain
    // const queryResult = await postgresEndpoint.query(wordEmbeddings, PostgresDistanceMetric.COSINE, topK, probes);

    // // Chain 6 ==> Create Prompt using Embeddings
    // const retrievedDocs: string[] = [];

    // for (const embeddings of queryResult) {
    //   retrievedDocs.push(
    //     `${embeddings.getRawText()}\n score:${embeddings.getScore()}\n filename:${embeddings.getFilename()}\n`
    //   );
    // }

    // if (retrievedDocs.join('').length > 4096) {
    //   retrievedDocs.length = 4096;
    // }

    // const currentTime = new Date().toLocaleString();
    // const formattedTime = currentTime;

    // // System prompt
    // const ansPromptSystem = jsonnet
    //                         .extString()
    //                         .evaluateFile('./hyde.jsonnet');
    
    // promptLoader.get('ans_prompt_system');
    // hydeLoader.put('promptTemplate', new JsonnetArgs(DataType.STRING, ansPromptSystem));
    // hydeLoader.put('time', new JsonnetArgs(DataType.STRING, formattedTime));
    // hydeLoader.put('query', new JsonnetArgs(DataType.STRING, retrievedDocs.join('')));
    // await hydeLoader.loadOrReload();
    // const finalPromptSystem = hydeLoader.get('prompt');

    // // User prompt
    // const ansPromptUser = promptLoader.get('ans_prompt_user');
    // hydeLoader.put('promptTemplate', new JsonnetArgs(DataType.STRING, ansPromptUser));
    // hydeLoader.put('query', new JsonnetArgs(DataType.STRING, query));
    // await hydeLoader.loadOrReload();
    // const finalPromptUser = hydeLoader.get('prompt');

    // const chatMessages: ChatMessage[] = [
    //   { sender: 'system', message: finalPromptSystem },
    //   { sender: 'user', message: finalPromptUser },
    // ];

    // const finalAnswer = await gptFnChat(chatMessages, arkRequest);

    // const response = {
    //   wordEmbeddings: queryResult,
    //   finalAnswer: finalAnswer,
    // };

    // return response;
  } catch (error) {
    // Handle errors here
    console.error(error);
    throw error;
  }
}

async function  gptFn(prompt:string, arkRequest): Promise<string> {

    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
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
    .then()
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

    return response.data.choices;
}

async function gptFnChat(chatMessages:ChatMessage[],arkRequest) {
    
}
