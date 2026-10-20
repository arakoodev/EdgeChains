local promptTemplate = |||
                        Given the following task description:
                        {task}
                        Extract the key actions from this task and return them as an array of strings. Each action should be a separate string in the array. If the task description contains syntax errors or you think a command can be improved for better clarity and effectiveness, please make the necessary corrections and improvements. For example:
                        Using the following list of objects, generate a series of instructions to fill out a form with the specified data. After each entry, include a command to submit the form. Follow this structure for each object:
                        Extract the details from each object in the list.
                        Format the details as follows: "Fill the form fields with the following data: First Name: [First Name], Last Name: [Last Name], Company Name: [Company Name], Role in Company: [Role in Company], Address: [Address], Email: [Email], Phone Number: [Phone Number]".
                        After each formatted string, append the text: "Identify and click on the input with the value 'Submit'".

                        Examples:

                        Input:
                        "Go to Hacker News and click on the first link. Then give me all the text of this page."
                        Response Format:
                        \`\`\`
                        {[
                        "Navigate to the Hacker News website by entering the URL 'https://news.ycombinator.com/' in the browser", 
                        "Identify and click on the first link displayed on the Hacker News homepage",  
                        "Extract all the text from the page",
                        "Return that containt using return statement"
                         ]}
                        \`\`\`

                        Input:
                        "Go to google and search for the term 'automation'. Click on the first link and extract the text from the page."

                        Response Format:
                        \`\`\`
                        {[
                        "Navigate to the random website by entering the URL 'https://google.com' in the browser", 
                        "Search for the term 'automation' in the search bar and hit Enter key",
                        "Click on the first link displayed in the search results",
                        "Extract  all the text from the page",
                        "Return that containt using return statement"
                        ]}
                        \`\`\`
                        \n
                        Ensure that each action is specific, clear, and comprehensive to facilitate precise implementation.
                       |||;


local openAIResponseFormat = [
    {
        name: "taskListResponse",
        description: "Generate a response containing a list of tasks.",
        parameters: {
            type: "object",
            properties: {
                tasks: {
                    type: "array",
                    description: "A list of tasks to be performed, represented as strings.",
                    items: {
                        type: "string",
                        description: "A single task description."
                    }
                }
            },
            required: ["tasks"]  // Ensure that the 'tasks' array is provided
        }
    }
];

local excelUrl = "https://rpachallenge.com/assets/downloadFiles/challenge.xlsx";
local key = std.extVar('openai_api_key');

local excelData = arakoo.native('downloadExcelData')({url:excelUrl});
local taskString = "go to https://rpachallenge.com/ click on the start button" + excelData;
local updatedPrompt = std.strReplace(promptTemplate, '{task}',taskString  + "\n");
local mainPrompt = arakoo.native("openAICall")({prompt:updatedPrompt, functions:openAIResponseFormat, openAIKey:key});
local doMainTasks = arakoo.native("doMainTasks")({task:mainPrompt, openai:key});
doMainTasks