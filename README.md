# EdgeChains Packages [![](https://img.shields.io/npm/v/%40arakoodev%2Fedgechains.js?style=flat-square&label=npmjs%3A%20%40arakoodev%2Fedgechains.js&link=https%3A%2F%2Fwww.npmjs.com%2Fpackage%2F%40arakoodev%2Fedgechains.js)](https://www.npmjs.com/package/@arakoodev/edgechains.js)  [![](https://img.shields.io/npm/v/%40arakoodev%2Fjsonnet?style=flat-square&label=npmjs%3A%20%40arakoodev%2Fjsonnet&link=https%3A%2F%2Fwww.npmjs.com%2Fpackage%2F%40arakoodev%2Fjsonnet)](https://www.npmjs.com/package/@arakoodev/jsonnet)




---
**Join our [Discord](https://discord.gg/aehBPdPqf5) - we are one of the friendliest and nicest dev groups in Generative AI !**

### ***Jump straight into our [examples](JS/edgechains/examples) WITH VIDEOS!!***


## Is EdgeChains production ready ?
unlike a lot of frameworks  - we built it on top of honojs and  jsonnet, both of which are built by cloudflare and google respectively.
so even if u dont trust me...u can trust them ;)

we dont build our own flavor of json or a specific DSL (that is inherently fragile) and give u compilation steps. Our underlying libraries are rock solid and stable.
<div align="center">

  <img src="https://img.shields.io/github/repo-size/arakoodev/EdgeChains?style=flat-square" />
  <img src="https://img.shields.io/github/issues/arakoodev/EdgeChains?style=flat-square" />
  <img src="https://img.shields.io/github/issues-pr/arakoodev/EdgeChains?style=flat-square" />
  <img src="https://img.shields.io/github/issues-pr-closed-raw/arakoodev/EdgeChains?style=flat-square" />
  <img src="https://img.shields.io/github/license/arakoodev/EdgeChains?style=flat-square" />
  <img src="https://img.shields.io/github/forks/arakoodev/EdgeChains?style=flat-square" />
  <img src="https://img.shields.io/github/stars/arakoodev/EdgeChains?style=flat-square" />
  <img src="https://img.shields.io/github/contributors/arakoodev/EdgeChains?style=flat-square" />
  <img src="https://img.shields.io/github/last-commit/arakoodev/EdgeChains?style=flat-square" />
  </div>
  

## Understanding EdgeChains

At EdgeChains, we take a unique approach to Generative AI - we think Generative AI is a deployment and configuration management challenge rather than a UI and library design pattern challenge. We build on top of a tech that has solved this problem in a different domain - Kubernetes Config Management - and bring that to Generative AI.
Edgechains is built on top of jsonnet, originally built by Google based on their experience managing a vast amount of configuration code in the Borg infrastructure. 

Edgechains gives you:

* **Just One Script File**: EdgeChains is engineered to be extremely simple - Executing production-ready GenAI applications is just one script file and one jsonnet file. You'll be pleasantly surprised!
* **Versioning for Prompts**: Prompts are written in jsonnet. Makes them easily versionable and diffable. 
* **Automatic parallelism**: EdgeChains automatically parallelizes LLM chains & chain-of-thought tasks across CPUs, GPUs, and TPUs using the WebAssembly runtime.
* **Fault tolerance**: EdgeChains is designed to be fault-tolerant, and can continue to retry & backoff even if some of the requests in the system fail.
* **Scalability**: EdgeChains is designed to be scalable, and can be used to write your chain-of-thought applications on large number of APIs, prompt lengths and vector datasets.

## Why do you need Prompt & Chain Engineering
Most people who are new to Generative AI think that the way to use OpenAI or other LLMs is to simply ask it a question and have it magically reply. The answer is extremely different and complex.

### Complexity of Prompt Engineering
Generative AI, OpenAI and LLMs need you to write your prompt in very specific ways. Each of these ways to write prompts is very involved and highly complex - it is in fact so complex that there are research papers published for this. E.g.:
- [Reason & Act - REACT style prompt chains](https://ai.googleblog.com/2022/11/react-synergizing-reasoning-and-acting.html)
- [HyDE prompt chains - Precise Zero-Shot Dense Retrieval without Relevance Labels](https://arxiv.org/abs/2212.10496)
- [FrugalGPT: How to Use Large Language Models While Reducing Cost and Improving Performance](https://arxiv.org/abs/2305.05176)

### *Prompt Explosion* - Too many Prompts for too many LLMs
Moreover, these prompt techniques work on one kind of LLMs, but dont work on other LLMs. For e.g. prompts & chains that are written in a specific way for GPT-3.5 will need to be rewritten for Llama2 **to achieve the same goal**. This causes prompts to explode in number, making them challenging to version and manage.

### Prompt ***Drift***
Prompts change over time. This is called Prompt Drift. There is enough published research to show how chatGPT's behavior changes. Your infrastructure needs to be capable enough to version/change with this drift. If you use libraries, where prompts are hidden under many layers, then you will find it IMPOSSIBLE to do this.
Your production code will rot over time, even if you did nothing.

-[How is ChatGPT's behavior changing over time?](https://arxiv.org/abs/2307.09009)

### Testability in Production
One of the big challenge in production is how to keep testing your prompts & chains and iterate on them quickly. If your prompts sit beneath many layers of libraries and abstractions, this is impossible. But if your prompts ***live outside the code*** and are declarative, this is easy to do. In fact, in EdgeChains, you can have your entire prompt & chain logic sit in s3 or an API.

### Token costs & measurement
Each prompt or chain has a token cost associated with it. You may think that a certain prompt is very good...but it may be consuming a huge amount of tokens. For example, Chain-of-Thought style prompts consume atleast 3X as many **output tokens** as a normal prompt. you need to have fine-grained tracking and measurement built into your framework to be able to manage this. Edgechains has this built in.


---

# Setup
1. Clone the repo into a public GitHub repository (or fork [https://github.com/arakoodev/EdgeChains/fork](https://github.com/arakoodev/EdgeChains/fork)).

``` 
  git clone https://github.com/arakoodev/EdgeChains/
```

2. Go to the project folder
```
  cd EdgeChains
```

# Run the ChatWithPdf example

This section provides instructions for developers on how to utilize the chat with PDF feature. By following these steps, you can integrate the functionality seamlessly into your projects.

---

1. Go to the ChatWithPdfExample
```
  cd JS/edgechains/examples/chat-with-pdf/
```

2. Install packages with npm

``` 
  npm install
```

3. Setup you secrets in `secrets.jsonnet`
```
  local SUPABASE_API_KEY = "your supabase api key here";


  local OPENAI_API_KEY = "your openai api key here";
    
  local SUPABASE_URL = "your supabase url here";
    
  {
    "supabase_api_key":SUPABASE_API_KEY,
    "supabase_url":SUPABASE_URL,
    "openai_api_key":OPENAI_API_KEY,
  }
   
```

4. Database Configuration

- Ensure that you have a PostgreSQL Vector database set up at [Supabase](https://supabase.com/vector).
- Go to the SQL Editor tab in Supabase.
- Create a new query using the New Query button.
- Paste the following query into the editor and run it using the Run button in the bottom right corner.

```
create table if not exists documents (
    id bigint primary key generated always as identity,
    content text,
    embedding vector (1536)
  );

create or replace function public.match_documents (
   query_embedding vector(1536), 
  similarity_threshold float, 
    match_count int
)
returns table (
  id bigint,
  content text,
  similarity float
)
language sql
as $$
  select
  id,
  content,
   1- (documents.embedding <=> query_embedding) as similarity
  from documents
  where 1 - (documents.embedding <=> query_embedding) > similarity_threshold
  order by documents.embedding <=> query_embedding
  limit match_count;
  $$;

```

- You should see a success message in the Result tab.


## Usage

1. Start the server:

    ```bash
    npm run start
    ```

2. Hit the `GET` endpoint.

    ```bash
    http://localhost:3000/chatWithpdf?question=who is nirmala sitarama
   
- Then you can run the ChatWithPdf example using npm run start and continue chatting with the example.pdf.
  
⚠️👉Remember: Comment out the InsertToSupabase function if you are running the code again; otherwise, the PDF data will be pushed again to the Supabase vector data.


## Contribution guidelines

**If you want to contribute to EdgeChains, make sure to read the [Contribution CLA](https://github.com/arakoodev/.github/blob/main/CLA.md). This project adheres to EdgeChains [code of conduct]( https://github.com/arakoodev/.github/blob/main/CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.**

**We use [GitHub issues](https://github.com/arakoodev/edgechains/issues) for tracking requests and bugs.**



## 💌 Acknowledgements
We would like to express our sincere gratitude to the following individuals and projects for their contributions and inspiration:
- We draw inspiration from the spirit of [Nextjs](https://github.com/vercel/next.js/).
- We extend our appreciation to all the [contributors](https://github.com/wootzapp/wootz-browser/graphs/contributors) who have supported and enriched this project.
- Respect to LangChain, Anthropic, Mosaic and the rest of the open-source LLM community. We are deeply grateful for sharing your knowledge and never turning anyone away.


## License

EdgeChains  is licensed under the GNU Affero General Public License v3.0 and as commercial software. For commercial licensing, please contact us or raise a issue in this github.
