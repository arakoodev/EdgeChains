import { NextRequest, NextResponse } from "next/server";
import path from "path";
// @ts-ignore
import createClient from "sync-rpc";
import fileURLToPath from "file-uri-to-path";
import Jsonnet from "@arakoodev/jsonnet";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const jsonnet = new Jsonnet();

const openAICall = createClient(
  path.join(__dirname, "../../lib/generateResponse.cjs"),
);
const getQueryMatch = createClient(
  path.join(__dirname, "../../lib/getQueryMatch.cjs"),
);
const getEmbeddings = createClient(
  path.join(__dirname, "../../lib/getEmbeddings.cjs"),
);

export async function GET(request: NextRequest) {
  console.time("ExecutionTime");
  const searchStr = (
    request.nextUrl.searchParams.get("question") || ""
  ).toLowerCase();
  jsonnet.extString("query", searchStr);
  jsonnet.javascriptCallback("getEmbeddings", getEmbeddings);
  jsonnet.javascriptCallback("getQueryMatch", getQueryMatch);
  jsonnet.javascriptCallback("openAICall", openAICall);
  const response = JSON.parse(
    jsonnet.evaluateFile(path.join(__dirname, "../../../jsonnet/main.jsonnet")),
  );
  console.timeEnd("ExecutionTime");
  return NextResponse.json(response);
}
