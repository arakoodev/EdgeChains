
local maxTokens = if(payload.keepMaxTokens == "true") then payload.maxTokens else 10000;
local preset = |||
                  Use the following pieces of context to answer the question at the end. If
                  you don't know the answer, just say that you don't know, don't try to make up an answer.
                |||;
local query = "Question: "+ payload.query;
local context = if(payload.keepContext == "true") then payload.context else "";
local history = "Chat History: "+ if(payload.keepHistory == "true") then payload.history else "";

local prompt = std.join("\n", [query, preset, context, history]);
{
    "maxTokens": maxTokens,
    "topK": 5,
    "query": query,
    "preset" : preset,
    "context": context,
    "history": history,
    "prompt":  if(std.length(prompt) > xtr.parseNum(maxTokens)) then std.substr(prompt, 0, xtr.parseNum(maxTokens)) else prompt
}