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

Large language models (LLMs) have revolutionized the way developers create applications by unlocking new possibilities. However, leveraging the full potential of LLMs often requires integrating them with other sources of computation or knowledge. Edgechains is specifically designed to facilitate the development of such applications, enabling developers to harness the true power of LLMs by seamlessly combining them with complementary technologies. 

Specifically built for Java, EdgeChains is an open-source chain-of-thought engineering framework tailored for Large Language Models (LLMs) and OpenAI GPT. With a focus on enterprise-grade applications and scalability, EdgeChains addresses the complexities and challenges associated with working with OpenAI APIs. 

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
## Understanding EdgeChains

At EdgeChains, we take a unique approach to development, viewing it as a deployment and configuration management challenge rather than solely focusing on the user interface and code library aspects. We understand the difficulties developers face when using OpenAI APIs, which can result in code complexity and prompt-related issues.  To overcome them, we have leveraged the power of jsonnet, the advanced library developed by Google based on their experience managing a vast amount of configuration code in the Borg infrastructure, which underlies their extensive cloud and Kubernetes clusters. And building on top of this, Edgechains gives you:

* **Versioning for Prompts**: Prompts are written in jsonnet. Makes them easily versionable and diffable. 
* **Automatic parallelism**: EdgeChains automatically parallelizes LLM chains & chain-of-thought tasks across CPUs, GPUs, and TPUs using the JVM.
* **Fault tolerance**: EdgeChains is designed to be fault-tolerant, and can continue to retry & backoff even if some of the requests in the system fail.
* **Scalability**: EdgeChains is designed to be scalable, and can be used to write your chain-of-thought applications on large number of APIs, prompt lengths and vector datasets.

With EdgeChains, you can make your product live from day one, thanks to its robust features and seamless integration capabilities.

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
  --header 'Content-Type: application/json'
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
--header 'Content-Type: application/json'
 --data-raw '{
    "query": "What is the transformer architecture?"
}
```

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
- Rohan Guha ([@pizzaboi21](https://github.com/pizzaboi21))
- Anuran Roy ([@anuran-roy](https://github.com/anuran-roy))

## License

EdgeChains is licensed under the MIT license.
