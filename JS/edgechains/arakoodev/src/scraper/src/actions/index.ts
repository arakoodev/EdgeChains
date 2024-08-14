import { expect, Page } from '@playwright/test';
import {
    parseSite,
} from "../utils/index.js";
import { removeBlankTags } from '../utils/page-parser.js';

const AsyncFunction = async function () { }.constructor;

export async function generatePrompt(page: Page, userTask: string) {
    const [currentPageUrl, currentPageTitle, siteOverview] = await Promise.all([
        page.evaluate("location.href"),
        page.evaluate("document.title"),
        parseSite(page).then((html) => removeBlankTags(html).slice(0, 20000)),
    ]).catch((error: any) => {
        console.log(error.message + " " + error.stack);
        return error.message + " " + error.stack;
    });

    const systemPrompt = `
            You are a Senior SDET tasked with writing Playwright code for testing purposes. Your role involves implementing specific task-based code segments within a larger test file, following the instructions provided closely. Assume that common imports like 'test' and 'expect' from '@playwright/test' are already at the top of the file.

            Context:
            - Your computer is a Mac. Cmd is the meta key, META.
            - The browser is already open.
            - Current page URL: ${currentPageUrl}.
            - Current page title: ${currentPageTitle}.
            - Overview of the site in HTML format:
            \`\`\`
            ${siteOverview}
            \`\`\`

            Key Points:
            - Start directly with Playwright actions as described in the user task, without adding extraneous steps or assertions.
            - Include assertions like 'expect' statements or wait functions such as 'waitForLoadState' only when they are specifically requested in the user task.
            - Minimal, relevant comments should be used to clarify complex actions or essential aspects of the test's purpose.
            - Apply 'frameLocator' for content in nested iframes, as needed based on the task requirements.

            User Task: ${userTask}

            Expected Code Format:
            \`\`\`
            // [Insert Playwright code based on the task description. Begin with necessary actions directly, and include 'waitForLoadState', assertions, or 'expect' statements only if explicitly requested in the task. Comments should be concise and pertinent, especially for complex actions or decisions.]
            \`\`\`

            The objective is to create Playwright code that is efficient, precise, and perfectly aligned with the task's requirements, integrating seamlessly into the larger test file. All actions and comments should be relevant and necessary, catering to a senior-level professional's understanding of the testing scenario.`;

    return systemPrompt;

}


export function generateTaskArrPrompt(task: string) {
    return `
        Given the following task description:

        ${task}

        Extract the key actions from this task and return them as an array of strings. Each action should be a separate string in the array. If the task description contains syntax errors or you think a command can be improved for better clarity and effectiveness, please make the necessary corrections and improvements. For example:

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
        "Go to random website. we have fields in this pattern First Name	Last Name 	Company Name	Role in Company	Address	Email	Phone Number and then fill this fields John	Smith	IT Solutions	Analyst	98 North Road "

        'Response Format:
       \`\`\`
       {[
       "Navigate to the random website by entering the URL 'https://www.randomwebsite.com/' in the browser", 
        "Fill the form fields with the following data: First Name: John, Last Name: Smith, Company Name: IT Solutions, Role in Company: Analyst, Address: 98 North Road, Email:",  
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
    `;
}


export function handleHistory(goalsArr: string[]): { role: string, content: string }[] {
    let goalsStr = ''
    for (let index = 0; index < goalsArr.length; index++) {
        const element = goalsArr[index];
        goalsStr += `${index + 1}. Goal ${index + 1}: ${element}\n`
    }

    return [{
        role: 'system',
        content: `You are a Senior SDET tasked with writing Playwright code for testing purposes. Your role         
            involves implementing specific task-based code segments within a larger test file, following the 
            instructions provided closely. Assume that common imports like 'test' and 'expect' from '@playwright/test' are already at the top of the file.\n` +
            'Your decisions must always be made independently without seeking user assistance. Play to your strengths as an LLM and pursue simple strategies with no legal complications. We have three function to perform tasks "goToLink", "intractWithPage" and "findInPage". If any task have need to go to any url use or need go to a specific url use "goToLink" command. If any task takes more then 3 requests, use the "findInPage" command so we can try searching for the element using a function but do not use "findInPage" command unnecessary it has a cost.Otherwise use intractWithPage most of the times and Ensure that If you have completed all your tasks, make sure to use the "finish" command and args also should blank. do not use this command until each and every command completed successfully\n' +
            '\n' +
            'GOALS:\n' +
            '\n' +
            goalsStr +
            '\n' +
            `Key Points:
            - Always include the "args" object with the necessary arguments for the command. This field is required and must not be omitted.
            - Start directly with Playwright actions as described in the user task, without adding extraneous steps or assertions.
            - Include assertions like 'expect' statements or wait functions such as 'waitForLoadState' only when they are specifically requested in the user task.
            - Minimal, relevant comments should be used to clarify complex actions or essential aspects of the test's purpose.
            - Apply 'frameLocator' for content in nested iframes, as needed based on the task requirements.\n
            - Don't log the output always return that
            `+
            'Constraints:\n' +
            '1. ~4000 word limit for short term memory. \n' +
            '2. If you are unsure how you previously did something or want to recall past events, thinking about similar events will help you remember.\n' +
            '3. No user assistance\n' +
            '4. Exclusively use the commands listed below e.g. command_name\n' +
            '\n' +
            'Commands:\n' +
            `// for navigating to the page
            - await page.goto('https://github.com/login');
            // for clicking on the button
            - await page.getByRole('button', { name: 'Submit' }).click();
            // for filling the input fields
            - await page.getByLabel('Username or email address').fill('username');
            - await page.getByLabel('Password').fill('password');
            // Text input
            - await page.getByRole('textbox').fill('Peter');
            // Date input
            - await page.getByLabel('Birth date').fill('2020-02-02');
            // Time input
            - await page.getByLabel('Appointment time').fill('13:15');
            // Local datetime input
            - await page.getByLabel('Local time').fill('2020-03-02T05:15');
            - await page.locator('[data-test="password"]').fill('secret_sauce');
            - await page.getByRole('button', { name: 'Sign in' }).click();
            - await page.innerText('html')
            - page.getByRole('listitem').filter({ hasText: 'Product 2' });
            - await page.getByRole('listitem').filter({ hasText: 'Product 2' }).getByRole('button', { name: 'Add to cart' }).click();
            - page.locator('button.buttonIcon.episode-actions-later');
            - await expect(page.getByText('welcome')).toBeVisible();
            - await expect(page.getByText('welcome')).toBeVisible();
            - await page.innerText(selector);
            - await page.innerText(selector, options);
            - const page = await browser.newPage();
            - await page.goto('https://keycode.info');
            - await page.press('body', 'A');
            - await page.screenshot({ path: 'A.png' });
            - await page.press('body', 'ArrowLeft');
            - await page.screenshot({ path: 'ArrowLeft.png' });
            - await page.press('body', 'Shift+O');
            - await page.screenshot({ path: 'O.png' });
            - await browser.close();
            // click on any links
            - await page.click('a[href="https://blog.sbensu.com/posts/demand-for-visual-programming/"]');\n\n`+
            '\n' +
            '\n' +
            'Resources:\n' +
            '1. Internet access for searches and information gathering.\n' +
            '2. Long Term memory management.\n' +
            '3. GPT-3.5 powered Agents for delegation of simple tasks.\n' +
            '\n' +
            'Performance Evaluation:\n' +
            '1. Continuously review and analyze your actions to ensure you are performing to the best of your abilities.\n' +
            '2. Constructively self-criticize your big-picture behavior constantly.\n' +
            '3. Reflect on past decisions and strategies to refine your approach.\n' +
            '4. Every command has a cost, so be smart and efficient. Aim to complete tasks in the least number of steps.'
    }];
}

export async function findInPage(page: Page, task: string): Promise<string> {

    const [currentPageUrl, currentPageTitle, siteOverview] = await Promise.all([
        await page.evaluate('location.href'),
        await page.evaluate('document.title'),
        parseSite(page).then((html) => removeBlankTags(html).slice(0, 24000)),
    ]).catch((error: any) => {
        console.log(error.message + " " + error.stack);
        return error.message + " " + error.stack;
    });

    return `
    You are a programmer and your job is to pick out information in code to a pm. You are working on an html file. You will extract the necessary content asked from the information provided. 
                                    
    Context:
    Your computer is a mac. Cmd is the meta key, META.
    The browser is already open. 
    Current page url is ${currentPageUrl}.
    Current page title is ${currentPageTitle}.
                    
    Here is the overview of the site. Format is in html:
    \`\`\`
     ${siteOverview}
    \`\`\`
    \n\n

    User Task: ${task}

    `;
}

export const mainResponseFormat = [
    {
        name: "response",
        description: "Generate a detailed response based on provided details.",
        parameters: {
            type: "object",
            properties: {
                thoughts: {
                    type: "object",
                    description: "A collection of thoughts including reasoning and plans.",
                    properties: {
                        text: {
                            type: "string",
                            description: "thought"
                        },
                        reasoning: {
                            type: "string",
                            description: "reasoning"
                        },
                        plan: {
                            type: "string",
                            description: "- short bulleted\n- list that conveys\n- long-term plan"
                        },
                        criticism: {
                            type: "string",
                            description: "constructive self-criticism"
                        },
                        speak: {
                            type: "string",
                            description: "thoughts summary to say to user"
                        }
                    },
                    required: ["text", "reasoning", "plan", "criticism", "speak"]
                },
                command: {
                    type: "object",
                    description: "A command to be executed based on the current context.",
                    properties: {
                        name: {
                            type: "string",
                            description: "The name of the command to execute."
                        },
                        args: {
                            type: "object",
                            description: "Arguments required for executing the command.",
                            "additionalProperties": true,
                        }
                    },
                    required: ["name", "args"]
                }
            },
            required: ["thoughts", "command"]
        }
    }
];

export const taskArrResponseFormat = [
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

export const playwrightCodeResponseFormat = [
    {
        name: "playwrightCode",
        description: "Generates playwright Code code for a given task",
        parameters: {
            type: "object",
            properties: {
                code: {
                    type: "string",
                    description: "Playwright code for a single task."
                }
            },
            required: ["code"]
        }
    }
];

export async function execPlayWrightCode(page: Page, code: string): Promise<string> {
    const dependencies = [
        { param: 'page', value: page },
        { param: 'expect', value: expect },
    ];

    const func = AsyncFunction(...dependencies.map((d) => d.param), code);
    const args = dependencies.map((d) => d.value);
    return await func(...args);
}

export async function goToLink(page: Page, url: string): Promise<any> {
    await page.goto(url);
}