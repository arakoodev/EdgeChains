local keepMaxTokens = payload.keepMaxTokens;
local maxTokens = if keepMaxTokens == "true" then payload.maxTokens else 5120;

local preset = |||
                 You are a Summary Generator Bot. For any question other than summarizing the data, you should tell that you cannot answer it.
                    You should detect the language and the characters the user is writing in, and reply in the same character set and language.

                    You should follow the following template while answering the user:

                    ```
                    1. <POINT_1> - <DESCRIPTION_1>
                    2. <POINT_2> - <DESCRIPTION_2>
                    ...
                    ```
                    Now, given the data, create a 5-bullet point summary of:
               |||;
local keepContext = payload.keepContext;
local context = if keepContext == "true" then payload.context else "";
local prompt = std.join("\n", [preset, context]);
{
    "maxTokens": maxTokens,
    "typeOfKeepContext": xtr.type(keepContext),
    "preset" : preset,
    "context": context,
    "prompt": if(std.length(prompt) > xtr.parseNum(maxTokens)) then std.substr(prompt, 0, xtr.parseNum(maxTokens)) else prompt
}