import { chromium, Page } from "playwright";
import axios from "axios";
import { retry } from "@lifeomic/attempt";
import {
    playwrightCodeResponseFormat,
    findInPage,
    generatePrompt,
    generateTaskArrPrompt,
    handleHistory,
    mainResponseFormat,
    taskArrResponseFormat,
    execPlayWrightCode,
    goToLink,
} from "../actions";
const openaiUrl = "https://api.openai.com/v1/chat/completions";

type messages = { role: string; content: string }[];

export class Playwright {
    apiKey: string;
    model: string;
    verbose: boolean;
    constructor({
        apiKey,
        model,
        verbose = true,
    }: {
        apiKey: string;
        model: string;
        verbose?: boolean;
    }) {
        this.apiKey = apiKey;
        this.model = model;
        this.verbose = verbose;
    }

    static #history: messages = [];

    #getHistory() {
        return Playwright.#history;
    }

    #setHistory(message: { role: string; content: string }) {
        Playwright.#history.push(message);
    }

    async #getThoughtAndCommands() {
        const openaiResponse = await this.#openAIRequest(
            [
                ...this.#getHistory(),
                {
                    role: "user",
                    content:
                        'Determine which next command to use, ensuring that the "args" field is always populated with the necessary arguments, and respond using the format specified above.',
                },
            ],
            mainResponseFormat,
            mainResponseFormat[0].name
        );
        this.#setHistory({ role: "assistant", content: openaiResponse.function_call.arguments });
        return await JSON.parse(openaiResponse.function_call.arguments);
    }

    async #interactWithPage(page: Page, task: string) {
        const taskMessage = [
            {
                role: "user",
                content: generateTaskArrPrompt(task),
            },
        ];

        const taskResponse = await this.#openAIRequest(
            taskMessage,
            taskArrResponseFormat,
            taskArrResponseFormat[0].name
        );
        const taskArr = JSON.parse(taskResponse.function_call.arguments).tasks;
        if (this.verbose == true) {
            console.log("GOALS: ", taskArr);
        }
        const history = handleHistory(taskArr);
        history.map((element) => {
            this.#setHistory(element);
        });
        let commandRunningAttempt: number = 0;
        let playwrightResponse: string = "";
        let isFinishCount: number = 0;
        while (1) {
            const parsedOpenaiResponse = await this.#getThoughtAndCommands();
            let command = parsedOpenaiResponse.command;
            if (this.verbose == true) {
                console.log(parsedOpenaiResponse);
            }

            if (command.name == "finish") {
                isFinishCount++;
                if (isFinishCount >= 2) {
                    break;
                }
                this.#setHistory({
                    role: "assistant",
                    content: `Command finish args: ${command?.args || "NO ARGUMENTS PROVIDED"}`,
                });
                this.#setHistory({
                    role: "system",
                    content: `I need to insure that all the commmands is finished or Not?`,
                });
                continue;
            }

            if (command.name == "goToLink") {
                try {
                    await goToLink(page, command.args.url);
                    this.#setHistory({
                        role: "system",
                        content: `Command ${command.name} returned: Success`,
                    });
                } catch (error: any) {
                    this.#setHistory({
                        role: "system",
                        content: `Args: ${command.args}. Error: ${error.message + error.stack}`,
                    });
                }
                continue;
            }

            if (command.name == "findInPage" || commandRunningAttempt >= 3) {
                const findInPagePrompt = await findInPage(
                    page,
                    JSON.stringify(parsedOpenaiResponse)
                );
                const findInPageRespones = await this.#openAIRequest([
                    { role: "system", content: findInPagePrompt },
                    {
                        role: "user",
                        content:
                            "Try finding something in the html body content of the current webpage. use this content to figure out your next step. The task should be written question explaining what you want to find. You can find something like css selector, classes, link, tag, etc. So we can locate the element",
                    },
                ]);
                if (this.verbose == true) {
                    console.log(findInPageRespones.content);
                }
                this.#setHistory({ role: "assistant", content: findInPageRespones.content });
                command = await this.#getThoughtAndCommands();
            }

            const prompt = await generatePrompt(page, JSON.stringify(command));
            const playwrightCodeResponse = await this.#openAIRequest(
                [{ role: "user", content: prompt }],
                playwrightCodeResponseFormat,
                playwrightCodeResponseFormat[0].name
            );
            const playwrightCode = JSON.parse(playwrightCodeResponse.function_call.arguments).code;
            if (this.verbose == true) {
                console.log("Code To Run: ", playwrightCode);
            }
            this.#setHistory({ role: "assistant", content: playwrightCode });

            let result: string = "";
            try {
                playwrightResponse = await execPlayWrightCode(page, playwrightCode);
                result = `Command ${command.name} returned: Success`;
                this.#setHistory({ role: "system", content: result });
                commandRunningAttempt = 0;
            } catch (error: any) {
                if (command.name === "ERROR") {
                    result = `Error: ${command.args}.`;
                    this.#setHistory({ role: "system", content: result });
                    continue;
                }

                result = `Unknown command '${command.name}'. Please refer to the 'COMMANDS' list for available commands and only respond in the specified JSON format. Assistant Reply commands: ${command}\nResult: ${error.message} \n ${error.stack}`;

                this.#setHistory({ role: "system", content: result });
                commandRunningAttempt++;
            }
        }

        return playwrightResponse;
    }

    async #openAIRequest(
        message: { role: string; content: string }[],
        functions?: {
            name: string;
            description: string;
            parameters: {};
        }[],
        functionCall?: string
    ): Promise<any> {
        const funsObj = functions
            ? {
                  functions,
                  function_call: functionCall ? { name: functionCall } : "auto",
              }
            : {};

        try {
            const response = await axios.post(
                openaiUrl,
                {
                    model: this.model,
                    messages: message,
                    max_tokens: 1024,
                    temperature: 0.7,
                    ...funsObj,
                },
                {
                    headers: {
                        Authorization: `Bearer ${this.apiKey} `,
                        "content-type": "application/json",
                    },
                }
            );
            return response.data.choices[0].message;
        } catch (error: any) {
            console.log(error.message + "\n" + error.stack);
        }
    }

    /**
     * Get Playwright code for a specific task
     * @param task - Task description
     * @param url - URL to navigate to default is https://www.google.com
     * @param headless - Run in headless mode default is false
     **/
    async call({ task, url, headless = true }: { task: string; url?: string; headless?: boolean }) {
        if (!this.apiKey || this.apiKey == undefined) {
            console.log(
                "Please provide apiKey, You can find you apikey here https://platform.openai.com/"
            );
            process.exit();
        }
        const browser = await chromium.launch({ headless });
        const page = await browser.newPage();
        await page.goto(url || "https://www.google.com");
        return await this.#interactWithPage(page, task);
    }
}
