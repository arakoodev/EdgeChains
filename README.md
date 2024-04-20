# EdgeChains : LLM chains on-the-edge
<div align="center">

  <img src="https://img.shields.io/github/repo-size/arakoodev/EdgeChains?style=for-the-badge" />
  <img src="https://img.shields.io/github/issues/arakoodev/EdgeChains?style=for-the-badge" />
  <img src="https://img.shields.io/github/issues-pr/arakoodev/EdgeChains?style=for-the-badge" />
  <img src="https://img.shields.io/github/issues-pr-closed-raw/arakoodev/EdgeChains?style=for-the-badge" />
  <img src="https://img.shields.io/github/license/arakoodev/EdgeChains?style=for-the-badge" />
  <img src="https://img.shields.io/github/forks/arakoodev/EdgeChains?style=for-the-badge" />
  <img src="https://img.shields.io/github/stars/arakoodev/EdgeChains?style=for-the-badge" />
  <img src="https://img.shields.io/github/contributors/arakoodev/EdgeChains?style=for-the-badge" />
  <img src="https://img.shields.io/github/last-commit/arakoodev/EdgeChains?style=for-the-badge" />
  </div>
  
---
**Join our [Discord](https://discord.gg/aehBPdPqf5) - we are one of the friendliest and nicest dev groups in Generative AI !**

Leveraging the full potential of Large language models (LLMs) often requires integrating them with other sources of computation or knowledge. Edgechains is specifically designed to **orchestrate** such applications.

EdgeChains is an open-source chain-of-thought engineering framework tailored for Large Language Models (LLMs)- like OpenAI GPT, LLama2, Falcon, etc. - With a focus on enterprise-grade deployability and scalability. 

## Understanding EdgeChains

At EdgeChains, we take a unique approach to Generative AI - we think Generative AI is a deployment and configuration management challenge rather than a UI and library design pattern challenge. We build on top of a tech that has solved this problem in a different domain - Kubernetes Config Management - and bring that to Generative AI.
Edgechains is built on top of jsonnet, originally built by Google based on their experience managing a vast amount of configuration code in the Borg infrastructure. 

Edgechains gives you:

* **Just One Script File**: EdgeChains is engineered to be extremely simple (whether Java, Python or JS). Executing production-ready GenAI applications is just one script file and one jsonnet file. You'll be pleasantly surprised!
* **Versioning for Prompts**: Prompts are written in jsonnet. Makes them easily versionable and diffable. 
* **Automatic parallelism**: EdgeChains automatically parallelizes LLM chains & chain-of-thought tasks across CPUs, GPUs, and TPUs using the JVM.
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



<!-- Demo if present -->

---
## Installation and Usage

### [Stuck?? Try the Docs](https://www.arakoo.ai/doc/category/getting-started)

### Initial setup

To set up EdgeChains, you will need to download the release jar.

### Downloading the release jar

> **Note:** EdgeChains requires Java version 17 or above to run. Please make sure you have Java 17 installed on your system before proceeding.

You can download the release jars and associated files from the [latest release](https://github.com/arakoodev/EdgeChains/releases/tag/0.3.0). Make sure to download the `flyfly.jar`, `edgechain-app-1.0.0.jar` and the `Source code.zip` file from the assets section. 

Once downloaded, Follow these steps:

1. Create a new folder in your desired location and add the jar files into the newly created folder.

2. Copy all the contents from the _Examples_ folder and paste into your folder. The _Examples_ folder includes all the Jsonnet files and `EdgeChainApplication.java` file.    

4. Navigate to the directory in which you have extracted the files within the IntelliJ IDE. Make sure to use a **JBang project**. 
---

### Run EdgeChains

To run EdgeChains successfully, you will need to ensure that you have the necessary configurations in place. Follow the steps below to set up your EdgeChains application:

1. **Prepare your OpenAI Key:** EdgeChains requires a valid OpenAI key to interact with the language models. Make sure you have your OpenAI Auth Key available, as you will need to add it to the Starter class in `EdgeChainApplication.java` file.

2. **Configure Redis Connection:** locate the redisenv method in the Redisenv class in `EdgeChainApplication.java` file. Add your Redis URL, port, and password to the appropriate fields in the method.

Once you have completed these configuration steps, you are ready to run EdgeChains. 

To start the application, execute the following command in your terminal:

```bash
# To start the application.
java -jar flyfly.jar jbang EdgeChainApplication.java edgechain-app-1.0.0.jar
```
---
### Tutorial - Document-based Chatting with EdgeChains

Sometimes the best way to understand a complicated system is to start by understanding a basic example. The following example illustrates how to run your own Automata agent. The agent will be initialized with a trivial instruction, and will then attempt to write code to fulfill the instruction. The agent will then return the result of its attempt.

EdgeChains can be used to chat with a document. For example, you can chat with a document about the topic of "Bitcoin" or "Machine Learning" or any topic of your choice. For this, you can use the `EdgeChainService` class. 

1. Fill in the `EdgeChainApplication.java` file with the appropriate OpenAI and Redis credentials.
2. Run the following command in the terminal:   
  
  ```bash
  java -jar flyfly.jar jbang EdgeChainServiceApplication.java edgechain-app-1.0.0.jar
  ```

Now, you have to create a chat context, similar to a Chat Session in ChatGPT. Use the following command:

  ```bash
  curl  -X POST \
  'localhost:8080/v1/examples/historycontext' \
  --header 'Accept: /' \
  --header 'User-Agent: Thunder Client (https://www.thunderclient.com/)' \
  --header 'Content-Type: application/json' \
  --data-raw '{
    "maxTokens": 4096
  }'
  ```

You'll get a response like:

<details>
<summary>Click to see the sample response</summary>

```json
{
  "id": "historycontext-571b0c2c-8d07-452b-a1d8-96bd5f82234e",
  "maxTokens": 4096,
  "message": "Session is created. Now you can start conversational question and answer"
}
```
</details>

You will receive a response containing an `id` for the created session. Make sure to save this `id` for future use.

Now, Upsert a document to EdgeChains using the following command:

```bash
curl  -X POST \
  'localhost:8080/v1/redis/openai/upsert' \
  --header 'Accept: */*' \
  --header 'User-Agent: Thunder Client (https://www.thunderclient.com)' \
  --form 'file=@./8946-Article Text-12474-1-2-20201228.pdf'
```

Now, it's time to start chatting with the document by asking questions. For example, to inquire about the "transformer architecture," use the following command:

```bash
curl --location 'localhost:8080/v1/examples/redis/openai/chat?query=What%20is%20the%20transformer%20architecture%3F&namespace=machine-learning&id=historycontext%3A50756d25-e7e4-4d7c-862c-f81bf3f8eea0' \
--header 'Content-Type: application/json' \
 --data-raw '{
    "query": "What is the transformer architecture?"
}
```

# Run the chatWithPdf example

This section provides instructions for developers on how to utilize the chat with PDF feature. By following these steps, you can integrate the functionality seamlessly into your projects.

---

## Overview

Arakoo.ai provides a powerful feature that allows developers to match query embeddings against document embeddings stored in a PostgreSQL database. 

---

## Setup Instructions

### 1. Database Configuration

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

- Then you can run the ChatWithPdf example using npm run start and continue chatting with the example.pdf.
  
Remember: Comment out the InsertToSupabase function if you are running the code again; otherwise, the PDF data will be pushed again to the Supabase vector data.


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
