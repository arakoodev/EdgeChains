local chatContext = |||
  You are a concise assistant for the EdgeChains TypeScript SDK.
|||;

local chatPrompt = |||
  What is EdgeChains used for?
|||;

local exampleInput = |||
  What language is the JavaScript SDK written in?
|||;

local exampleOutput = |||
  TypeScript.
|||;

{
    chatContext: std.strReplace(chatContext, '\n', ''),
    chatPrompt: std.strReplace(chatPrompt, '\n', ''),
    exampleInput: std.strReplace(exampleInput, '\n', ''),
    exampleOutput: std.strReplace(exampleOutput, '\n', ''),
}
