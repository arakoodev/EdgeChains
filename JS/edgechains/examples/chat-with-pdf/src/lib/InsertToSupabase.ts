import { fileURLToPath } from "url";
import { Spinner } from "cli-spinner"
import { PdfLoader } from "@arakoodev/edgechains.js/document-loader";
import { TextSplitter } from "@arakoodev/edgechains.js/splitter";
import { createRequire } from 'module';
import { Supabase } from "@arakoodev/edgechains.js/vector-db";
import Jsonnet from "@arakoodev/jsonnet";
import path from "path"
import fs from "fs";

const require = createRequire(import.meta.url)

const getEmbeddings = require("./getEmbeddings.cjs")

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
const supabaseApiKey = await JSON.parse(secretsLoader).supabase_api_key;
const supabaseUrl = await JSON.parse(secretsLoader).supabase_url;
const supabase = new Supabase(supabaseUrl, supabaseApiKey);
const client = supabase.createClient();

export async function InsertToSupabase(content:any) {
    var spinner = new Spinner("Inserting to Supabase.. %s");
    try {
        spinner.setSpinnerString("|/-\\");
        spinner.start();

        const response = await getEmbeddings()(content);
        for (let i = 0; i < response?.length; i++) {
            if (content[i].length <= 1) {
                continue;
            }

            const element = response[i].embedding;
            await supabase.insertVectorData({
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