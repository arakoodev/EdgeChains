
local functionPrompt = std.join(" ",[ 
    payload.prompt+"I need a Exact json format like this:  ",
    payload.format
]);

{
    "functionPrompt": functionPrompt
}