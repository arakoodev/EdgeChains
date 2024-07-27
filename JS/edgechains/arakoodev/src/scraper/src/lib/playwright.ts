import { chromium, Page } from "playwright";
import { expect } from "@playwright/test";
import axios from "axios";
import { parseArr, parseSite, preprocessJsonInput } from "../utils/index";
import { retry } from "@lifeomic/attempt";
import { removeBlankTags } from "../utils/page-parser";

export class Playwright {
    apiKey: string;

    constructor({ apiKey }: { apiKey: string }) {
        this.apiKey = apiKey;
    }

    async #createPrompt({ task, page, completedTaskArr }) {
        const [currentPageUrl, currentPageTitle, siteOverview] = await Promise.all([
            page.evaluate("location.href"),
            page.evaluate("document.title"),
            parseSite(page).then((html) => removeBlankTags(html).slice(0, 20000)),
        ]);

        const completedActions = completedTaskArr || [];

        return `
        You are a Senior SDET tasked with writing Playwright code for testing purposes. Your role involves implementing specific task-based code segments within a larger test file, following the instructions provided closely. Assume that common imports like 'test' and 'expect' from '@playwright/test' are already at the top of the file.
    
        Context:
        - Your computer is a Mac. Cmd is the meta key, META.
        - The browser is already open.
        - Current page URL: ${currentPageUrl}.
        - Current page title: ${currentPageTitle}.
        - [NO NEED TO WRITE CODE TO OPEN THIS URL AGAIN ${currentPageUrl}, THE BROWSER IS ALREADY OPEN]
        - HumanMessage Write Playwright code for this: ${task}
        - Overview of the site in HTML format:
        \\\
        ${siteOverview}
        \\\
    
        Completed Actions: ${completedActions.join(", ")}
    
        Key Points:
        - Don't navigate to a new page unless explicitly instructed.
        - Don't give every links like this await page.click('a[href="https:^]'), only click on the specific link mentioned in the task.
        - Please note that if there is a timeout error, you may need to increase the timeout value or use a different method to locate the input fields.
        - Follow the following Playwright actions for the task:
            // for navigating to the page
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
            - await page.click('a[href="https://blog.sbensu.com/posts/demand-for-visual-programming/"]');
        
        - Start directly with Playwright actions without adding extraneous steps or assertions.
        - Include assertions like 'expect' statements or wait functions such as 'waitForLoadState' only when they are specifically requested in the user task.
        - Apply 'frameLocator' for content in nested iframes, as needed based on the task requirements.
        
        Expected Code Format:
        \\\
        // Insert Playwright code based on the task description. Begin with necessary actions directly, and include 'waitForLoadState', assertions, or 'expect' statements only if explicitly requested in the task. Comments should be concise and pertinent, especially for complex actions or decisions.]
        \\\
    
        The objective is to create Playwright code that is efficient, precise, and perfectly aligned with the task's requirements, integrating seamlessly into the larger test file. All actions should be relevant and necessary, catering to a senior-level professional's understanding of the testing scenario.
    
    
        Examples:
            go to hacker news -  await page.goto('https://news.ycombinator.com/') 
            click on the first link -  page.click('a[href="https://blog.sbensu.com/posts/demand-for-visual-programming/"]')
            give me all the text of this page - await page.innerText('html');
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
            \`\`\`

            Input:
            "Go to random website. we have fields in this pattern First Name	Last Name 	Company Name	Role in Company	Address	Email	Phone Number and then fill this fields John	Smith	IT Solutions	Analyst	98 North Road "

            Output:
           \`\`\`
           [
           "Navigate to the random website by entering the URL 'https://www.randomwebsite.com/' in the browser", 
            "Fill the form fields with the following data: First Name: John, Last Name: Smith, Company Name: IT Solutions, Role in Company: Analyst, Address: 98 North Road, Email:",  
            ]
            \`\`\`

            Input:
            "Go to google and search for the term 'automation'. Click on the first link and extract the text from the page."

            Output:
           \`\`\`
           [
           "Navigate to the random website by entering the URL 'https://google.com' in the browser", 
            "Search for the term 'automation' in the search bar and hit Enter key",
            "Click on the first link displayed in the search results",
            "Extract and return all the text content from the page"
            ]
            \`\`\`


            Ensure that each action is specific, clear, and comprehensive to facilitate precise implementation.
        `;
    }

    async #openAIRequest({ prompt }: { prompt: string }) {
        return await retry(async () => {
            const response = await axios.post(
                "https://api.openai.com/v1/chat/completions",
                {
                    model: "gpt-3.5-turbo-16k",
                    messages: [{ role: "user", content: prompt }],
                    max_tokens: 1000,
                    temperature: 0.7,
                },
                {
                    headers: {
                        Authorization: `Bearer ${this.apiKey}`,
                        "content-type": "application/json",
                    },
                }
            );
            return response.data.choices[0].message.content;
        });
    }

    async #findInPage({ page, task }): Promise<string> {
        const prompt = `
            You are a programmer and your job is to pick out information in code to a pm. You are working on an html file. You will extract the necessary content asked from the information provided. 
                        
            Context:
            Your computer is a mac. Cmd is the meta key, META.
            The browser is already open. 
            Current page url is ${await page.evaluate("location.href")}.
            Current page title is ${await page.evaluate("document.title")}.
            Humman message: ${task}
                        
            Here is the overview of the site. Format is in html:
            \`\`\`
            ${removeBlankTags(await parseSite(page)).slice(0, 25000)}
            \`\`\`
        `;

        return await this.#openAIRequest({ prompt });
    }

    async #execPlayWrightCode({ page, code }: { page: Page; code: string }) {
        const AsyncFunction = async function () {}.constructor;
        const dependencies = [{ param: "page", value: page }];
        const func = AsyncFunction(...dependencies.map((d) => d.param), code);
        const args = dependencies.map((d) => d.value);
        return await func(...args);
    }

    /**
     * Get Playwright code for a specific task
     * @param task - Task description
     * @param url - URL to navigate to default is https://www.google.com
     * @param headless - Run in headless mode default is false
     **/
    async call({ task, url, headless = true }: { task: string; url?: string; headless?: boolean }) {
        const browser = await chromium.launch({ headless });
        const page = await browser.newPage();
        await page.goto(url || "https://www.google.com");

        const taskPrompt = this.#createPromptForTaskArr(task);
        const taskArr: any = parseArr(await this.#openAIRequest({ prompt: taskPrompt }));

        const completedTaskArr: string[] = [];
        let response: string = "";
        let err;

        for (const task of taskArr) {
            if (response) break;

            console.log(task);
            let success = false;
            let action = "";
            const prompt = await this.#createPrompt({ task, page, completedTaskArr });
            let errExecIndex = 0;

            while (!success) {
                let res: any = preprocessJsonInput(
                    await this.#openAIRequest({ prompt: prompt + err })
                );

                if (errExecIndex > 3) {
                    const findInResponse = await this.#findInPage({ page, task });
                    const retryPrompt = await this.#createPrompt({
                        task: `We are getting this error three times: ${err}. Try writing Playwright code using this: ${findInResponse}`,
                        page,
                        completedTaskArr,
                    });
                    res = preprocessJsonInput(await this.#openAIRequest({ prompt: retryPrompt }));
                }

                try {
                    const finalResponse = await this.#execPlayWrightCode({ page, code: res });
                    if (finalResponse) response = finalResponse;
                    completedTaskArr.push(action);
                    success = true;
                } catch (error: any) {
                    err = `\n\nError in this command ${action}  Error: ${error.message}\n${error.stack} Try another way to do this action`;
                    console.log("Error: ", error.message);
                    errExecIndex++;
                }
            }
        }

        await browser.close();
        return response;
    }
}
