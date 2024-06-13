# EdgeChains Packages [![](https://img.shields.io/npm/v/%40arakoodev%2Fedgechains.js?style=flat-square&label=npmjs%3A%20%40arakoodev%2Fedgechains.js&link=https%3A%2F%2Fwww.npmjs.com%2Fpackage%2F%40arakoodev%2Fedgechains.js)](https://www.npmjs.com/package/@arakoodev/edgechains.js)  [![](https://img.shields.io/npm/v/%40arakoodev%2Fjsonnet?style=flat-square&label=npmjs%3A%20%40arakoodev%2Fjsonnet&link=https%3A%2F%2Fwww.npmjs.com%2Fpackage%2F%40arakoodev%2Fjsonnet)](https://www.npmjs.com/package/@arakoodev/jsonnet)




---
**Join our [Discord](https://discord.gg/aehBPdPqf5) - we are one of the friendliest and nicest dev groups in Generative AI !**

Leveraging the full potential of Large language models (LLMs) often requires integrating them with other sources of computation or knowledge. Edgechains is specifically designed to **orchestrate** such applications.

EdgeChains is an open-source chain-of-thought engineering framework tailored for Large Language Models (LLMs)- like OpenAI GPT, LLama2, Falcon, etc. - With a focus on enterprise-grade deployability and scalability. 

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
![image](https://github.com/Shyam-Raghuwanshi/EdgeChains/assets/94217498/052d9a15-838f-4e68-9888-072cecb78a13)

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

---

# Compilation to webassembly for edge devices
## Setup

 1. Select latest successful workflow run from [here](https://github.com/arakoodev/EdgeChains/actions/workflows/release-wasm.yml) .
 2. Then scroll to bottom and download artifact . A zip will be downloaded to your system 
 3. Extract the zip . 
 4. You will have two binaries `arakoo` *(this is runtime)* and `arakoo-compiler` *(this is our extended javy compiler)*
 5. Copy these two binaries to `~/.local/bin` or `/usr/bin` *(if you want all users to access the binaries )*
 6. Open terminal and grant executable permission to copied binaries by running `chmod +x "<path of copied arakoo-compiler>"` and `chmod +x "<path of copied arakoo>"`

 *You are now good to go ! Have look at below  section which describe how you can create apis in hono and compile them to wasm*
 
 ## Compiling js to wasm
1. Open Terminal
2. Create a new directory `helloworld` by running 
 ```mkdir helloworld && cd helloworld```  
3. Initialize it 
```npm init -y```
4. Add `"type":"module"` in package.json to use es6 syntax.
5. Install hono `npm install hono@^3.9` (as of now only this hono version is supported)
6. Create a `index.js` file and open it with your favourite editor.
7. Paste below code in it
```js
import {Hono} from  "hono";
const  app = new  Hono();

app.get("/hello", async (c)=>{
	return  c.json({message :  "hello world"})
})

app.fire();
```
8.  Now since javy doesn't have capablity to require or imort module . So we will bundle the index.js with esbuild.
9. To do so , install esbuild as developer dependency 
```
npm install esbuild --save-dev
```  
10. Create a build file `build.js`
11. Paste below code in it
```js
import {build} from  "esbuild";

build({
	entryPoints: ["index.js"], // specify input file ( in this case this the index.js file we created earlier)
	bundle:  true, // this allows esbuild to find all dependencies and bundle them together in one file
	outfile:  "dist.js", // the name of the output bundle file you desire ( in this case we named it dist.js
	platform:"node",
}).catch((error)=>{
	console.log("Error ",error);
	process.exit(1);
})
```
12. Now compile bundled file with javy 
```
arakoo-compiler dist.js 
```
13. You should see a new file `index.wasm` in the directory

## Executing wasm
You can execute the compiled wasm with installed `arakoo` runtime.
To do so simple run 
```
arakoo index.wasm
``` 
You should see output as -

![image](https://github.com/redoC-A2k/EdgeChains/assets/60838316/75bab29e-de61-4f1b-87ea-66b921441a66)

Send get request to http://localhost:8080/hello to test the api.
You should get response as shown below \-

![image](https://github.com/redoC-A2k/EdgeChains/assets/60838316/6796513d-63e3-4ce4-a797-ffd20ac0b7a1)

---

## Contribution guidelines

**If you want to contribute to EdgeChains, make sure to read the [Contribution CLA](https://github.com/arakoodev/.github/blob/main/CLA.md). This project adheres to EdgeChains [code of conduct]( https://github.com/arakoodev/.github/blob/main/CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.**

**We use [GitHub issues](https://github.com/arakoodev/edgechains/issues) for tracking requests and bugs.**

<!-- Add when discussions are present
please see [Automata Discussions](https://github.com/arakoodev/edgechains/discussions) for general questions and discussion, and please direct specific questions. -->

To ensure clean and effective pull request merges, we follow a specific approach known as **squash and merge**. It is crucial to avoid issuing multiple pull requests from the same local branch, as this will result in failed merges.

The solution is straightforward: adhere to the principle of **ONE BRANCH PER PULL REQUEST**. We strictly follow this practice to ensure the smooth integration of contributions. 

If you have inadvertently created a pull request from your master/main branch, you can easily rectify it by following these steps:

> Note: Please ensure that you have committed all your changes before proceeding, as any uncommitted changes will be lost.

 if you have created this pull request using your master/main branch, then follow these steps to fix it:
```
git branch newbranch      # Create a new branch, saving the desired commits
git checkout master       # checkout master, this is the place you want to go back
git reset --hard HEAD~3   # Move master back by required number of commits 
git checkout newbranch    # Go to the new branch that still has the desired commits. 
```
Now, you can create a pull request. 

The Edgechains project strives to abide by generally accepted best practices in open-source software development.

## Future

We are committed to the continuous improvement and expansion of EdgeChains. Here are some of the exciting developments we have planned for the future. Our team is dedicated to pushing the boundaries of what is possible with large language models and ensuring that EdgeChains remains at the forefront of innovation. We are actively exploring and incorporating the latest advancements in large language models, ensuring that EdgeChains stays up to date with cutting-edge technologies and techniques. We also have a strong focus on optimizing the scalability and performance of EdgeChains. Our goal is to improve parallelism, fault tolerance, and resource utilization, allowing applications built with EdgeChains to handle larger workloads and deliver faster responses.

To support our growing user community, we are expanding our documentation and resources. This includes providing comprehensive tutorials, examples, and guides to help developers get started and make the most out of EdgeChains


## 💌 Acknowledgements
We would like to express our sincere gratitude to the following individuals and projects for their contributions and inspiration:

- First Hat tip to  [Spring](https://github.com/spring-projects/spring-framework).
- We draw inspiration from the spirit of [Nextjs](https://github.com/vercel/next.js/).
- We extend our appreciation to all the [contributors](https://github.com/wootzapp/wootz-browser/graphs/contributors) who have supported and enriched this project.
- Respect to LangChain, Anthropic, Mosaic and the rest of the open-source LLM community. We are deeply grateful for sharing your knowledge and never turning anyone away.


## ✍️ Authors and Contributors

- Sandeep Srinivasa ([@sandys](https://twitter.com/sandeepssrin))
- Arth Srivastava [@ArthSrivastava](https://github.com/ArthSrivastava)
- Harsh Parmar [@Harsh4902](https://github.com/Harsh4902)
- Rohan Guha ([@pizzaboi21](https://github.com/pizzaboi21))
- Anuran Roy ([@anuran-roy](https://github.com/anuran-roy))

## License

EdgeChains is licensed under the MIT license.
