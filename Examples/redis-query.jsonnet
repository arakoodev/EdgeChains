
local maxTokens = if(std.extVar("keepMaxTokens") == true) then std.extVar("maxTokens") else 10000;
local preset = |||
                  Use the following pieces of context to answer the question at the end. If
                  you don't know the answer, just say that you don't know, don't try to make up an answer.
                |||;
local context = if(std.extVar("keepContext") == true) then std.extVar("context") else "";
local prompt = std.join("\n", [preset, context]);
{
    "maxTokens": maxTokens,
    "preset" : preset,
    "context": context,
    "prompt": if(std.length(prompt) > maxTokens) then std.substr(prompt, 0, maxTokens) else prompt
}