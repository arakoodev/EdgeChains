import fileURLToPath from "file-uri-to-path";
import { Spinner } from "cli-spinner";
import { PdfLoader } from "@arakoodev/edgechains.js/document-loader";
import { TextSplitter } from "@arakoodev/edgechains.js/splitter";
import { createRequire } from "module";
import {QdrantService} from "@arakoodev/edgechains.js/vector-db";
import Jsonnet from "@arakoodev/jsonnet";
import path from "path";
import fs from "fs";

const require = createRequire(import.meta.url);

const getEmbeddings = require("./getEmbeddings.cjs");

const __dirname = fileURLToPath(import.meta.url);

const pdfPath = path.join(__dirname, "../../../example.pdf");
const pdfData = fs.readFileSync(pdfPath);
const bufferPdf = Buffer.from(pdfData);
const loader = new PdfLoader(bufferPdf);
const docs = await loader.loadPdf();
const splitter = new TextSplitter();
export const splitedDocs = await splitter.splitTextIntoChunks(docs, 500);

const secretsPath = path.join(__dirname, "../../../jsonnet/secrets.jsonnet");

const jsonnet = new Jsonnet();

const secretsLoader = jsonnet.evaluateFile(secretsPath);
const qdrantApiUrl = await JSON.parse(secretsLoader).qdrant_api_url;
const qdrantApiKey = await JSON.parse(secretsLoader).qdrant_api_key;
const qdrant = new QdrantService(qdrantApiUrl, qdrantApiKey);

export async function InsertToQdrant(content: any) {
    var spinner = new Spinner("Inserting to Qdrant.. %s");

    try {
        spinner.setSpinnerString("|/-\\");
        spinner.start();
        await qdrant.assignCollection();
        const collectionName=qdrant.collectionName;
        const response = await getEmbeddings()(content);
        for (let i = 0; i < response?.length; i++) {
            if (content[i].length <= 1) {
                continue;
            }

            const element = response[i].embedding;
            await qdrant.upsertPoints({
                collectionName,
                payload: content[i].toLowerCase(),
                vector: element,
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

export { qdrant };