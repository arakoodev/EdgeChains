
local maxTokens = if(payload.keepMaxTokens == "true") then payload.maxTokens else 10000;
local preset = |||
                  You will be given context that may or may not be related to the question. If the context is related to the question, use it to answer the question.
                   Otherwise, say that you don't know the answer, and attempt to answer it anyways using an 'In General' format
                |||;
local context = if(payload.keepContext == "true") then payload.context else "";
local prompt = std.join("\n", [preset, context]);
{
    "maxTokens": maxTokens,
    "preset" : preset,
    "context": context,
    "prompt": if(std.length(prompt) > xtr.parseNum(maxTokens)) then std.substr(prompt, 0, xtr.parseNum(maxTokens)) else prompt
}