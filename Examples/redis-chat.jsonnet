
local maxTokens = if(std.extVar("keepMaxTokens") == true) then std.extVar("maxTokens") else 10000;
local preset = |||
                  Use the following pieces of context to answer the question at the end. If
                  you don't know the answer, just say that you don't know, don't try to make up an answer.
                |||;
local query = "Question: "+std.extVar("query");
local context = if(std.extVar("keepContext") == true) then std.extVar("context") else "";
local history = "Chat History: "+ if(std.extVar("keepHistory") == true) then std.extVar("history") else "";

local prompt = std.join("\n", [query, preset, context, history]);
{
    "maxTokens": maxTokens,
    "topK": 5,
    "query": query,
    "preset" : preset,
    "context": context,
    "history": history,
    "prompt":  if(std.length(prompt) > maxTokens) then std.substr(prompt, 0, maxTokens) else prompt
}