local keepContext = std.extVar("keepContext");
local promptType = "thought";
local tokenCap = 4096;
local maxLength = if std.extVar("capContext") == "true" then std.parseInt(std.extVar("contextLength")) else tokenCap;
local context = if keepContext == "true" then std.extVar("context") else "";
local preset = |||
    Use the following pieces of context to answer the question at the end. If you don't know the answer, just say that you don't know, don't try to make up an answer.
|||;

local prompt = preset + "\n```\n" + context + "\n```";
local promptLength = std.length(prompt);

{
    promptLength: std.min(promptLength, maxLength),
    prompt: if promptLength > maxLength then std.substr(prompt, promptLength - maxLength, promptLength) else prompt,
    type: promptType,
}
