
local promptTemplate = |||
                        Please help me structure the following resume into a more organized format, ensuring clear sections for Professional Summary, Skills, Professional Experience, Education, and Projects. Ensure the content is concise, easy to read, and well-formatted. Additionally, please rate the resume using the following points system:
                        
                        One month of full-time experience gets 2.5 points
                        Participation in open-source work gets 10 points
                        One month of internship gets 1 point
                        Having interned at a top company or a top startup or a YC startup results in 6 bonus points
                        Having worked full-time at a top company or a top startup or a YC startup results in 12 bonus points
                        Each project that has a lot of users or has made a big impact gets 3 points
                        Having a project that is technically interesting or challenging gets 4 points
                        Clear and well-structured format gets 5 points
                        Strong professional summary gets 5 points
                        Well-defined skills section gets 5 points
                        Comprehensive and relevant experience details get 5 points
                        Detailed and impactful project descriptions get 5 points
                        The total score should be out of 100. After rating the resume, provide a verbose and detailed description of what needs to be changed or improved in the resume to make it better.

                        --------------------------------------------------
                        {resume}
                       |||;


local resume = std.extVar("resume");

local prompt = std.strReplace(promptTemplate,'{resume}', resume);

local main() =
    local response = arakoo.native("openAICall")(prompt);
    response;

main()