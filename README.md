# EdgeChains : LLM chains on-the-edge
**chain-of-thought engineering for LLM and OpenAI GPT. Built for Java. Built for Enterprise. Built for Scale**
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
<div align="center">
<img src="https://user-images.githubusercontent.com/76883/226261289-21a6fd42-ff6f-4d7a-9c59-3c7f149e0f56.png" width="200" height="200">
  </div>
EdgeChains, a framework for building large-scale distributed machine learning systems. EdgeChains is built on top of JAX, and provides a number of features that make it well-suited for building distributed machine learning systems, including:

* **Automatic parallelism**: EdgeChains automatically parallelizes LLM chains & chain-of-thought tasks across CPUs, GPUs, and TPUs using the JVM.
* **Fault tolerance**: EdgeChains is designed to be fault-tolerant, and can continue to retry & backoff even if some of the requests in the system fail.
* **Scalability**: EdgeChains is designed to be scalable, and can be used to write your chain-of-thought applications on large number of APIs, prompt lengths and vector datasets.

# What does it look like ?

![image](/.github/assets/code.png)

## 🎊 Community

💫💫💫 **we would be very grateful if you could take 5 seconds to star our repository on Github. It helps get the word out to more LLM developers & open source committers about edgechains.** 💫💫💫

- Follow our [Twitter](https://twitter.com/arakoodev)
- Join  [Discord](https://discord.gg/MtEPK9cnSF) to write code, get help, or to chat with us!!!
- Open a [discussion](https://github.com/arakoodev/edgechains/discussions/new) with your question, or
- Open [a bug](https://github.com/arakoodev/edgechains/issues/new)
- Check open [Github Issues](https://github.com/arakoodev/edgechains/issues)
- Make sure to read our [contributing CLA](https://github.com/arakoodev/.github/blob/main/CLA.md).


## 🧐 Contributing Guidelines (There is only one)

This project hopes and requests for clean pull request merges. the way we merge is squash and merge. This fundamentally can only work if you **NEVER ISSUE A PULL REQUEST TWICE FROM THE SAME LOCAL BRANCH**. If you create another pull request from same local branch, then the merge will always fail.

solution is simple - **ONE BRANCH PER PULL REQUEST**. We Follow this strictly. if you have created this pull request using your master/main branch, then follow these steps to fix it:
```
# Note: Any changes not committed will be lost.
git branch newbranch      # Create a new branch, saving the desired commits
git checkout master       # checkout master, this is the place you want to go back
git reset --hard HEAD~3   # Move master back by 3 commits (Make sure you know how many commits you need to go back)
git checkout newbranch    # Go to the new branch that still has the desired commits. NOW CREATE A PULL REQUEST
```

## 💌 Acknowledgements

- First Hat tip to  [Spring](https://github.com/spring-projects/spring-framework).
- We are inspired by the spirit of [Nextjs](https://github.com/vercel/next.js/).
- All the other [contributors](https://github.com/wootzapp/wootz-browser/graphs/contributors).
- Respect to LangChain, Anthropic, Mosaic and the rest of the opensource LLM community. We are deeply grateful for sharing your knowledge and never turning anyone away.

## ✍️ Authors and Contributors

- Sandeep Srinivasa ([@sandys](https://twitter.com/sandeepssrin))
- Rohan Guha ([@pizzaboi21](https://github.com/pizzaboi21))

We love contributors! Feel free to contribute to this project but please read the [CLA](https://github.com/wootzapp/.github/blob/main/CLA.md) first!

<a href="https://github.com/arakoodev/edgechains/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=arakoodev/edgechains&max=300&columns=12&anon=0" />
</a>

## 📜 License

edgechains is open-source OSS software licensed under the MIT license.
