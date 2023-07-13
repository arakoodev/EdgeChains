
local maxTokens = if(std.extVar("keepMaxTokens") == true) then std.extVar("maxTokens") else 10000;
local preset = |||
                  You will be given context that may or may not be related to the question. If the context is related to the question, use it to answer the question.
                   Otherwise, say that you don't know the answer, and attempt to answer it anyways using an 'In General' format
                   Follow Up Input: {question}
                   Context: {context}
                   Chat History: {chat_history}
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