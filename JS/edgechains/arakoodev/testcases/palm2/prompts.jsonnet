local generateTextPrompt = |||
  Write a one-sentence product tagline for EdgeChains.
|||;

local countTokensPrompt = |||
  How many tokens are in this sentence?
|||;

local embedText = |||
  EdgeChains JavaScript SDK
|||;

{
    generateTextPrompt: std.strReplace(generateTextPrompt, '\n', ''),
    countTokensPrompt: std.strReplace(countTokensPrompt, '\n', ''),
    embedText: std.strReplace(embedText, '\n', ''),
}
