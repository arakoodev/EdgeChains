import { chromium } from "playwright";
import axios from "axios";
import { parseArr, parseSite, preprocessJsonInput } from "../utils/index";
import retry from "retry";
import { removeBlankTags } from "../utils/page-parser";

export class Playwright {
    constructor() {}

    async #createPrompt({ task, page }: { task: string; page: any }) {
        return `
        You are a Senior SDET tasked with writing Playwright code for testing purposes. Your role involves implementing specific task-based code segments within a larger test file, following the instructions provided closely. Assume that common imports like 'test' and 'expect' from '@playwright/test' are already at the top of the file.

        Context:
        - Your computer is a Mac. Cmd is the meta key, META.
        - The browser is already open.
        - Current page URL: ${await page.evaluate("location.href")}.
        - Current page title: ${await page.evaluate("document.title")}.
        - Overview of the site in HTML format:
        \\\
        ${removeBlankTags(await parseSite(page)).slice(0, 25000)}
        \\\

        Key Points:
        - Start directly with Playwright actions as described in the user task, without adding extraneous steps or assertions.
        - Include assertions like 'expect' statements or wait functions such as 'waitForLoadState' only when they are specifically requested in the user task.
        - Minimal, relevant comments should be used to clarify complex actions or essential aspects of the test's purpose.
        - Apply 'frameLocator' for content in nested iframes, as needed based on the task requirements.
        - Store the output in a variable and Return the output not log that

        User Task: [Insert the specific user task here, including any detailed instructions related to the execution, waiting for specific conditions, or explicit requests for assertions and waits.]

        Expected Code Format:
        \\\
        // [Insert Playwright code based on the task description. Begin with necessary actions directly, and include 'waitForLoadState', assertions, or 'expect' statements only if explicitly requested in the task. Comments should be concise and pertinent, especially for complex actions or decisions.]
        \\\

        The objective is to create Playwright code that is efficient, precise, and perfectly aligned with the task's requirements, integrating seamlessly into the larger test file. All actions and comments should be relevant and necessary, catering to a senior-level professional's understanding of the testing scenario.
            
        HumanMessage Write Playwright code for this: ${task}

        Examples: 
            go to hacker news -  await page.goto('https://news.ycombinator.com/') 
            click on the first link -  page.click('a[href="https://blog.sbensu.com/posts/demand-for-visual-programming/"]')
            give me all the text of this page - await page.waitForLoadState('networkidle')


        Some Playwright Actions that should use for you reference: 
        - await page.goto('https://github.com/login');
        - await page.getByLabel('Username or email address').fill('username');
        - await page.getByLabel('Password').fill('password');
        - await page.getByRole('button', { name: 'Sign in' }).click();
        - await page.innerText('html')
        - page.getByRole('button', { name: 'submit' });
        - page.getByRole('listitem').filter({ hasText: 'Product 2' });
        - await page.getByRole('listitem').filter({ hasText: 'Product 2' }).getByRole('button', { name: 'Add to     cart' }).click();
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
        // click on the links, example
        - await page.click('a[href="https://blog.sbensu.com/posts/demand-for-visual-programming/"]');
        `;
    }

    #createPromptForTaskArr(task: string) {
        return `
            Given the following task description:

            ${task}

            Extract the key actions from this task and return them as an array of strings. Each action should be a separate string in the array. If the task description contains syntax errors or you think a command can be improved for better clarity and effectiveness, please make the necessary corrections and improvements. For example:

            Input:
            "Go to Hacker News and click on the first link. Then give me all the text of this page."

            Output:
           \`\`\`
           [
           "Navigate to the Hacker News website by entering the URL 'https://news.ycombinator.com/' in the browser", 
            "Identify and click on the first link displayed on the Hacker News homepage",  
            "Extract and return all the text content from the page"
            ]
            Ensure that each action is specific, clear, and comprehensive to facilitate precise implementation.
            \`\`\`
        `;
    }

    async #openAIRequest({ chatApi, prompt }: { chatApi: string; prompt: string }) {
        return new Promise((resolve, reject) => {
            const operation = retry.operation({
                retries: 5,
                factor: 3,
                minTimeout: 1 * 1000,
                maxTimeout: 60 * 1000,
                randomize: true,
            });

            operation.attempt(async function (currentAttempt) {
                await axios
                    .post(
                        "https://api.openai.com/v1/chat/completions",
                        {
                            model: "gpt-3.5-turbo-16k",
                            messages: [{ role: "user", content: prompt }],
                            max_tokens: 1000,
                            temperature: 0.7,
                        },
                        {
                            headers: {
                                Authorization: "Bearer " + chatApi,
                                "content-type": "application/json",
                            },
                        }
                    )
                    .then((response) => {
                        resolve(response.data.choices[0].message.content);
                    })
                    .catch((error) => {
                        if (error.response) {
                            console.log(
                                "Server responded with status code:",
                                error.response.status
                            );
                            console.log("Response data:", error.response.data);
                        } else if (error.request) {
                            console.log("No response received:", error);
                        } else {
                            console.log(
                                "Error creating request:",
                                error.message,
                                "\n",
                                "Retrying ",
                                currentAttempt
                            );
                        }
                        if (operation.retry(error)) {
                            return;
                        }
                        reject(error);
                    });
            });
        });
    }

    /**
     * Get Playwright code for a specific task
     * @param chatApi - OpenAI API key
     * @param task - Task description
     * @param url - URL to navigate to default is https://www.google.com
     * @param headless - Run in headless mode default is false
     * @returns Playwright code example - page.goto('https://www.google.com')
     **/
    async call({
        chatApi,
        task,
        url,
        headless = true,
    }: {
        chatApi: string;
        task: string;
        url?: string;
        headless?: boolean;
    }) {
        const AsyncFunction = async function () {}.constructor;

        const browser = await chromium.launch({
            headless: headless,
        });

        const page = await browser.newPage();
        await page.goto(url || "https://www.google.com");

        const taskPrompt = this.#createPromptForTaskArr(task);
        const taskArr: any = parseArr(await this.#openAIRequest({ chatApi, prompt: taskPrompt }));

        let response: string = "";

        for (let i = 0; i < taskArr.length; i++) {
            if (!response) {
                const element = taskArr[i];
                const prompt = await this.#createPrompt({ task: element, page });
                let res: any = preprocessJsonInput(await this.#openAIRequest({ chatApi, prompt }));
                const dependencies = [{ param: "page", value: page }];

                const func = AsyncFunction(...dependencies.map((d) => d.param), res);
                const args = dependencies.map((d) => d.value);

                try {
                    const res = await func(...args);
                    if (res) {
                        response = res;
                    }
                } catch (error: any) {
                    console.log(error);
                }
            }
        }

        await browser.close();
        return response;
    }
}
