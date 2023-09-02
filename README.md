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
## Installation and Usage Quickstart

**Edgechains works on Java & Android right now. Javascript is upcoming**

To set up EdgeChains, you will need to download the release jar (`edgechain.jar`) from [https://github.com/arakoodev/EdgeChains/releases](https://github.com/arakoodev/EdgeChains/releases)

Once downloaded, Follow these steps:

1. **Copy all the contents from the _Examples_ folder** and paste into your folder. The _Examples_ folder includes all the Jsonnet files and `EdgeChainApplication.java` file.    
2. **Prepare your OpenAI Key:** EdgeChains requires a valid OpenAI key to interact with the language models. Make sure you have your OpenAI Auth Key available, as you will need to add it to the Starter class in `EdgeChainApplication.java` file.
3. **Configure Redis/Supabase/Pincone Connection:** locate the redisenv method in the Redisenv class in `EdgeChainApplication.java` file. Add your URL, port, and password to the appropriate fields in the method.

Once you have completed these configuration steps, you are ready to run EdgeChains. 

To start the application, execute the following command in your terminal:

```bash
# Go inside any of the examples
java -jar edgechain.jar jbang Hello.java
```
### [Stuck?? Try the Docs](https://www.arakoo.ai/doc/category/getting-started)


## About Edgechains
Edgechains gives you:

* **Just One Script File**: EdgeChains is engineered to be extremely simple (whether Java, Python or JS). Executing production-ready GenAI applications is just one script file and one jsonnet file. You'll be pleasantly surprised!
* **Versioning for Prompts**: Prompts are written in jsonnet. Makes them easily versionable and diffable. 
* **Automatic parallelism**: EdgeChains automatically parallelizes LLM chains & chain-of-thought tasks across CPUs, GPUs, and TPUs using the JVM.
* **Fault tolerance**: EdgeChains is designed to be fault-tolerant, and can continue to retry & backoff even if some of the requests in the system fail.
* **Scalability**: EdgeChains is designed to be scalable, and can be used to write your chain-of-thought applications on large number of APIs, prompt lengths and vector datasets.

## Why do you need Prompt & Chain Orchestration ? 
Most people who are new to Generative AI think that the way to use OpenAI or other LLMs is to simply ask it a question and have it magically reply. The answer is extremely different and complex.

### Classical AI vs Generative AI - Training models is no longer needed..but Orchestration is still hard.

In classical AI, model build was the slowest part (and bottleneck) of an entire AI application. That was the part that took 6 months to build and so orchestration & other things did not matter - you could not accelerate the AI development process even if you accelerated orchestration.

Generative AI is ***"few shot"*** - meaning a ***prompt** can change the behavior of a model. You dont need to rebuild your model for different applications. This means, the bottleneck of model build goes away! And instead ***orchestration becomes the bottleneck***. Most other libraries still build GenAI libraries with the classical AI mindset - which is why prompts, chains and other parts of orchestration are hardcoded into Python classes (they assume that prompts & chains are the slowest moving parts of the equation).

Edgechains focuses on solving the orchestration problem by modeling it as a declarative config.

We build on top of a tech that has solved this problem in a different domain - Kubernetes Config Management - and bring that to Generative AI.
Edgechains is built on top of jsonnet, originally built by Google based on their experience managing a vast amount of configuration code in the Borg infrastructure. 

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

## 💌 Acknowledgements
We would like to express our sincere gratitude to the following individuals and projects for their contributions and inspiration:

- First Hat tip to  [Spring](https://github.com/spring-projects/spring-framework).
- We draw inspiration from the spirit of [Nextjs](https://github.com/vercel/next.js/).
- Respect to LangChain, Anthropic, Mosaic and the rest of the open-source LLM community. We are deeply grateful for sharing your knowledge and never turning anyone away.


## ✍️ Authors and Contributors

- Sandeep Srinivasa ([@sandys](https://twitter.com/sandeepssrin))
- Arth Srivastava [@ArthSrivastava](https://github.com/ArthSrivastava)
- Harsh Parmar [@Harsh4902](https://github.com/Harsh4902)
- Rohan Guha ([@pizzaboi21](https://github.com/pizzaboi21))
- Anuran Roy ([@anuran-roy](https://github.com/anuran-roy))

## License

EdgeChains is licensed under the MIT license.
