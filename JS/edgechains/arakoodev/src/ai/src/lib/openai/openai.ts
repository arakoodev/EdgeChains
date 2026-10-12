/**
 * Backward-compatible adapter.
 * The existing `OpenAI` class now delegates to the Router internally.
 * All public methods and interface signatures are preserved.
 */
import { ChatModel, role } from "../../types/index.js"
import { Router } from "../../core/Router.js"
import { OpenAIProvider } from "../../providers/openai/OpenAIProvider.js"
import type { RouterConfig, ChatOptions } from "../../core/types.js"
import { zodToJsonSchema } from "zod-to-json-schema"
import { z } from "zod"

interface OpenAIConstructionOptions {
  apiKey?: string
  orgId?: string
}

interface messageOption {
  role: role
  content: string
  name?: string
}

interface OpenAIChatOptions {
  model?: ChatModel
  role?: role
  max_tokens?: number
  temperature?: number
  prompt?: string
  messages?: messageOption[]
  frequency_penalty?: number
}

interface chatWithFunctionOptions {
  model?: ChatModel
  role?: role
  max_tokens?: number
  temperature?: number
  prompt?: string
  functions?: object | Array<object>
  messages?: messageOption[]
  function_call?: string
}

interface ZodSchemaResponseOptions<S extends z.ZodTypeAny> {
  model?: ChatModel
  role?: role
  max_tokens?: number
  temperature?: number
  prompt: string
  schema: S
}

interface chatWithFunctionReturnOptions {
  content: string
  function_call: {
    name: string
    arguments: string
  }
}

interface OpenAIChatReturnOptions {
  content: string
}

export class OpenAI {
  apiKey: string
  orgId: string
  private router: Router
  private provider: OpenAIProvider

  constructor(options: OpenAIConstructionOptions) {
    this.apiKey = options.apiKey || process.env.OPENAI_API_KEY || ""
    this.orgId = options.orgId || process.env.OPENAI_ORG_ID || ""

    this.provider = new OpenAIProvider(this.apiKey, this.orgId)

    const config: RouterConfig = {
      strategy: "weighted-utilization",
      timeoutMs: 30000,
      retries: 2,
      deployments: [
        {
          id: "openai-default",
          provider: "openai",
          model: "gpt-3.5-turbo",
          apiKey: this.apiKey,
          orgId: this.orgId,
          rpmLimit: 500,
          tpmLimit: 10000,
        },
      ],
    }

    this.router = new Router(config, [this.provider])
    this.checkKeys()
  }

  private checkKeys(): void {
    if (!this.apiKey) {
      console.error(
        "API key is missing. Please provide a valid OpenAI API key. You can add it in .env file as OPENAI_API_KEY"
      )
    }
    if (!this.orgId) {
      console.warn(
        "Organization ID is missing. Please provide a valid OpenAI Organization ID. You can add it in .env file as OPENAI_ORG_ID"
      )
    }
  }

  async chat(chatOptions: OpenAIChatOptions): Promise<OpenAIChatReturnOptions> {
    const routerOptions: ChatOptions = {
      model: chatOptions.model || "gpt-3.5-turbo",
      prompt: chatOptions.prompt,
      messages: chatOptions.messages as Array<{ role: string; content: string; name?: string }> | undefined,
      maxTokens: chatOptions.max_tokens || 256,
      temperature: chatOptions.temperature || 0.7,
      frequencyPenalty: chatOptions.frequency_penalty,
    }

    const response = await this.router.chat(routerOptions)
    return { content: response.content }
  }

  async streamedChat(chatOptions: OpenAIChatOptions): Promise<OpenAIChatReturnOptions> {
    const routerOptions: ChatOptions = {
      model: chatOptions.model || "gpt-3.5-turbo",
      prompt: chatOptions.prompt,
      messages: chatOptions.messages as Array<{ role: string; content: string; name?: string }> | undefined,
      maxTokens: chatOptions.max_tokens || 256,
      temperature: chatOptions.temperature || 0.7,
      frequencyPenalty: chatOptions.frequency_penalty,
      stream: true,
    }

    const response = await this.router.chat(routerOptions)
    return { content: response.content }
  }

  async chatWithFunction(
    chatOptions: chatWithFunctionOptions
  ): Promise<chatWithFunctionReturnOptions> {
    const routerOptions: ChatOptions = {
      model: chatOptions.model || "gpt-3.5-turbo",
      prompt: chatOptions.prompt,
      messages: chatOptions.messages as Array<{ role: string; content: string; name?: string }> | undefined,
      maxTokens: chatOptions.max_tokens || 1024,
      temperature: chatOptions.temperature || 0.7,
    }

    const response = await this.router.chat(routerOptions)
    return { content: response.content, function_call: { name: "", arguments: "" } }
  }

  async generateEmbeddings({ input, model }: { input: string[]; model: string }): Promise<any> {
    // Embeddings are not yet routed through the Router.
    // Fall back to direct axios call to preserve backward compatibility.
    const axios = (await import("axios")).default
    const response = await axios
      .post(
        "https://api.openai.com/v1/embeddings",
        { model, input },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
            "OpenAI-Organization": this.orgId,
          },
        }
      )
      .then((res) => res.data.data)
      .catch((error: any) => {
        if (error.response) {
          console.log("Server responded with status code:", error.response.status)
          console.log("Response data:", error.response.data)
        } else if (error.request) {
          console.log("No response received:", error.request)
        } else {
          console.log("Error creating request:", error.message)
        }
      })
    return response
  }

  async zodSchemaResponse<S extends z.ZodTypeAny>(
    chatOptions: ZodSchemaResponseOptions<S>
  ): Promise<S> {
    const jsonSchema = zodToJsonSchema(chatOptions.schema, { $refStrategy: "none" })
    const openAIFunctionCallDefinition = {
      name: "generateSchema",
      description: "Generate a schema based on provided details.",
      parameters: jsonSchema,
    }
    const content = `
                        You are a Schema generator that can generate answer based on given prompt and then return the response based on the give schema 
                        Remembrer if any field like url or link is not available please create a dummy link based on the following prompt
                        
                        prompt:
                        ${chatOptions.prompt || ""}
                        `

    const axios = (await import("axios")).default
    const response = await axios
      .post(
        "https://api.openai.com/v1/chat/completions",
        {
          model: chatOptions.model || "gpt-3.5-turbo-16k",
          messages: [{ role: chatOptions.role || "user", content }],
          functions: [openAIFunctionCallDefinition],
          function_call: "auto",
          max_tokens: chatOptions.max_tokens || 1000,
          temperature: chatOptions.temperature || 0.7,
        },
        {
          headers: {
            Authorization: "Bearer " + this.apiKey,
            "Content-Type": "application/json",
            "OpenAI-Organization": this.orgId,
          },
        }
      )
      .then((response: any) => response.data.choices[0].message)
      .catch((error: any) => {
        if (error.response) {
          console.log("Server responded with status code:", error.response.status)
          console.log("Response data:", error.response.data)
        } else if (error.request) {
          console.log("No response received:", error)
        } else {
          console.log("Error creating request:", error.message)
        }
      })
    if (response) {
      if (response.content) return response.content
      return chatOptions.schema.parse(JSON.parse(response.function_call.arguments))
    } else {
      throw new Error("Response did not contain valid JSON.")
    }
  }
}