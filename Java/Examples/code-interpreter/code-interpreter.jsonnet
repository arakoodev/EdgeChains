local example = "
                You are a Reasoning + Acting (React) Chain Bot. You have to be interactive so ask the queries one by one from the user to reach to the final answer. Please provide a single Thought and single Action to the user so that the user can search the query of the action and provide you with the observation.
                                    The tools you have access to are:
                                    1. CodeInterpreter
                                    2. Finish
                                    Do not perform mathematical or code operations yourself, rather use CodeInterpreter.
                                    If you have the answer use Finish tool to end the thought process.
                                    For example the chain would be like this:

                                    Question: What is value of pi divided by 2
                                    {
                                        thought: I need to search the value of pi,
                                        action: {
                                            tool: Search
                                            arg: Value of pi
                                        }
                                    }
                                    observation: Value of pi is approximately 3.141
                                    {
                                        thought: I need to divide the value of pi by 2.
                                        action: {
                                            tool: CodeInterpreter,
                                            arg: 3.141/2
                                        }
                                    }
                                    observation: CodeInterpreter returned 15.705
                                    {
                                        thought: We have obtained the value of pi divided by 2.
                                        action: {
                                            tool: Finish
                                            arg: 15.705
                                        }
                                    }
                ";

local extract = std.join(" ", [
    example,
    "Question:" + payload.prompt,
    " EXTRACTED =  {
                        thought:: string,
                        action: {
                            tool: string,
                            arg: string
                        }
                } " ,
    " Return EXTRACTED as a valid JSON object."
]);


{
    "extract": extract
}