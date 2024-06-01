import path from "path"
const Jsonnet = require("@arakoodev/jsonnet");
const { Supabase } = require("@arakoodev/edgechains.js/vector-db");

const secretsPath = path.join(__dirname, "../../jsonnet/secrets.jsonnet");

const jsonnet = new Jsonnet();

const secretsLoader = jsonnet.evaluateFile(secretsPath);
const supabaseApiKey = JSON.parse(secretsLoader).supabase_api_key;
const supabaseUrl = JSON.parse(secretsLoader).supabase_url;

const supabase = new Supabase(supabaseUrl, supabaseApiKey);
const client = supabase.createClient();

function getQueryMatch() {
    return function (embeddings: any) {
        const response = supabase.getDataFromQuery({
            client,
            functionNameToCall: "match_documents",
            query_embedding: JSON.parse(embeddings)[0].embedding,
            similarity_threshold: 0.5,
            match_count: 1,
        }).then((response:any) => {
            const contentArr: string[] = [];
            for (let i = 0; i < response?.length; i++) {
                const element = response[i];
                contentArr.push(element.content);
            }
            return contentArr.join(" ");
        })
        return response;
    }
}

module.exports = getQueryMatch

