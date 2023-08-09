local extract = std.join(" ", [
    "INPUT = " + payload.prompt,
    " EXTRACTED = " + payload.format,
    " Return EXTRACTED as a valid JSON object."
]);

local actionPrompt = std.join(" ", [
    "This is the situation: " + payload.situation,
    " These are the set of valid actions to take: " + payload.validAction,
    payload.callToAction
]);

local validActionCheckPrompt = std.join(" ", [
    "Given the situation: " + payload.situation,
    " And the action you choose: " + payload.response1,
    " Is the action you in this set of valid actions: " + payload.validAction,
    "? If not, choose the best valid action to take. If so, please return the original action"
]);

local ActionFormatPrompt = std.join(" ",[
    "This is the correct format for an action: " + payload.actionFormat,
    " This is the chosen action: " + payload.response2,
    " Convert the chosen action to the correct format."
]);

local getValidFormat = std.join(" ",[
    "This is the correct format for an action: " + payload.actionFormat,
    " This is a formatted action: " + payload.response3,
    " Return the action in the correct format."
]);

{
    "extract": extract,
    "actionPrompt": actionPrompt,
    "validActionCheckPrompt" : validActionCheckPrompt,
    "ActionFormatPrompt":ActionFormatPrompt,
    "getValidFormat":getValidFormat
}
