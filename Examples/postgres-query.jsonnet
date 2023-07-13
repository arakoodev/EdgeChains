
local maxTokens = if(std.extVar("keepMaxTokens") == true) then std.extVar("maxTokens") else 10000;
local preset = |||
                  You will be given context that may or may not be related to the question. If the context is related to the question, use it to answer the question.
                   Otherwise, say that you don't know the answer, and attempt to answer it anyways using an 'In General' format
                |||;
local context = if(std.extVar("keepContext") == true) then std.extVar("context") else "";
local prompt = std.join("\n", [preset, context]);
{
    "maxTokens": maxTokens,
    "preset" : preset,
    "context": context,
    "prompt": if(std.length(prompt) > maxTokens) then std.substr(prompt, 0, maxTokens) else prompt
}