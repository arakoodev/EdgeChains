import path from "path";
import fs from "fs";

import { fileURLToPath } from "url";
import { ChatOpenAi } from "@arakoodev/openai";
import { Supabase } from "@arakoodev/vector-db";
import { PdfLoader } from "@arakoodev/document-loader";
import { TextSplitter } from "@arakoodev/splitter";
import { ArakooServer } from "@arakoodev/arakooserver";
import { Spinner } from "cli-spinner";
const server = new ArakooServer();

const __dirname = fileURLToPath(import.meta.url);

const pdfPath = path.join(__dirname, "../../../example.pdf");
const pdfData = fs.readFileSync(pdfPath);
const bufferPdf = Buffer.from(pdfData);
const loader = new PdfLoader(bufferPdf);
const docs = await loader.loadPdf();
const splitter = new TextSplitter();
const splitedDocs = await splitter.splitTextIntoChunks(docs, 500);

export const ChatRouter: any = server.createApp();

const getJsonnet = async () => {
    let jsonnet = await import("@arakoodev/jsonnet");
    return jsonnet.default;
};

const promptPath = path.join(__dirname, "../../../jsonnet/prompt.jsonnet");
const InterPath = path.join(__dirname, "../../../jsonnet/intermediate.jsonnet");
const secretsPath = path.join(__dirname, "../../../jsonnet/secrets.jsonnet");

const Jsonnet = await getJsonnet();
const jsonnet = new Jsonnet();

const secretsLoader = jsonnet.evaluateFile(secretsPath);

const openAIApiKey = await JSON.parse(secretsLoader).openai_api_key;
const supabaseApiKey = await JSON.parse(secretsLoader).supabase_api_key;
const supabaseUrl = await JSON.parse(secretsLoader).supabase_url;

const supabase = new Supabase(supabaseUrl, supabaseApiKey);

const client = supabase.createClient();

const llm = new ChatOpenAi({
    openAIApiKey: openAIApiKey,
});

async function getEmbeddings(content) {
    const embeddings = await llm.generateEmbeddings(content);

    return embeddings;
}

async function InsertToSupabase(content) {
    var spinner = new Spinner("Inserting to Supabase.. %s");
    try {
        spinner.setSpinnerString("|/-\\");
        spinner.start();

        const response = await getEmbeddings(content);
        for (let i = 0; i < response?.length; i++) {
            if (content[i].length <= 1) {
                continue;
            }

            const element = response[i].embedding;
            const data = await supabase.insertVectorData({
                client,
                tableName: "documents",
                content: content[i].toLowerCase(),
                embedding: element,
            });
        }
        if (!response) {
            return console.log("Error inserting to Supabase");
        }
        console.log("Inserted to Supabase");
    } catch (error) {
        console.log("Error inserting to Supabase", error);
    } finally {
        spinner.stop();
    }
}
// this should run only once for uploding pdf data to supabase then you can continue with the chatbot functionality
// await InsertToSupabase(splitedDocs);

ChatRouter.get("/", async (c) => {
    const searchStr = c.req.query("question").toLowerCase();
    const promptLoader = jsonnet.evaluateFile(promptPath);

    const promptTemplate = await JSON.parse(promptLoader).custom_template;

    const embeddingsArr = await getEmbeddings(searchStr);
    const response = await supabase.getDataFromQuery({
        client,
        functionNameToCall: "match_documents",
        query_embedding: embeddingsArr[0].embedding,
        similarity_threshold: 0.5,
        match_count: 1,
    });
    const contentArr: string[] = [];
    for (let i = 0; i < response?.length; i++) {
        const element = response[i];
        contentArr.push(element.content);
    }

    const content = contentArr.join(" ");

    let InterLoader = await jsonnet
        .extString("promptTemplate", promptTemplate)
        .extString("query", searchStr || "")
        .extString("content", content)
        .evaluateFile(InterPath);

    const prompt = JSON.parse(InterLoader).prompt;
    const res = await llm.generateResponse(prompt);
    return c.json({ res });
});
