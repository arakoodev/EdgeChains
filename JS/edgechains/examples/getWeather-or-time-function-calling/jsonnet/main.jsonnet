local functions = [
  {
    name: "lookupTime",
    description: "get the current time in a given location",
    parameters: {
      type: "object", // specify that the parameter is an object
      properties: {
        location: {
          type: "string", // specify the parameter type as a string
          description: "The location, e.g. Beijing, China. But it should be written in a timezone name like Asia/Shanghai"
        }
      },
      required: ["location"] // specify that the location parameter is required
    }
  },
  {
    name: "lookupWeather",
    description: "get the weather forecast in a given location",
    parameters: {
      type: "object", // specify that the parameter is an object
      properties: {
        location: {
          type: "string", // specify the parameter type as a string
          description: "The location, e.g. Beijing, China. But it should be written in a city, state, country"
        }
      },
      required: ["location"] // specify that the location parameter is required
    }
  }
];


local user_input = std.extVar("user_input");

local completionResponse = std.parseJson(arakoo.native("openAIFunction")({prompt:user_input, functions:functions}));

// {
//   role: 'assistant',
//   content: null,
//   function_call: {
//     name: 'lookupWeather',
//     arguments: '{\n  "location": "Paris, France"\n}'
//   }
// }

if(completionResponse.content == null || completionResponse.content == "null") then 
    local functionCallName = completionResponse.function_call.name;
    if(functionCallName == "lookupTime") then
        local completionArguments = completionResponse.function_call.arguments;
        local completion_text = arakoo.native("lookupTime")(std.parseJson(completionArguments).location);
        completion_text
    else if(functionCallName == "lookupWeather") then
        local completionArguments = completionResponse.function_call.arguments;
        local completion_text = arakoo.native("lookupWeather")(std.parseJson(completionArguments).location);
        
        local completion = std.parseJson(arakoo.native("openAIChat")(completion_text));
        local completionResponse = completion.content;
        completionResponse
else 
    local completion_text = completionResponse.content;
    completion_text
