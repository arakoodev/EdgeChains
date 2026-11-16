# EdgeChains Packages [![](https://img.shields.io/npm/v/%40arakoodev%2Fedgechains.js?style=flat-square&label=npmjs%3A%20%40arakoodev%2Fedgechains.js&link=https%3A%2F%2Fwww.npmjs.com%2Fpackage%2F%40arakoodev%2Fedgechains.js)](https://www.npmjs.com/package/@arakoodev/edgechains.js)  [![](https://img.shields.io/npm/v/%40arakoodev%2Fjsonnet?style=flat-square&label=npmjs%3A%20%40arakoodev%2Fjsonnet&link=https%3A%2F%2Fwww.npmjs.com%2Fpackage%2F%40arakoodev%2Fjsonnet)](https://www.npmjs.com/package/@arakoodev/jsonnet)

---
**Join our [Discord](https://discord.gg/aehBPdPqf5) - we are one of the friendliest and nicest dev groups in Generative AI !**

### ***Jump straight into our [examples](JS/edgechains/examples) WITH VIDEOS!!***

## Is EdgeChains production ready?
Unlike many frameworks, we built EdgeChains on top of Hono and Jsonnet, which are maintained by Cloudflare and Google respectively. By leveraging these robust, industry-standard foundations rather than creating a proprietary DSL, we ensure stability and reliability for production workloads.

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
At EdgeChains, we treat Generative AI as a deployment and configuration management challenge. By utilizing Jsonnet—originally developed by Google for managing complex infrastructure at scale—we bring proven configuration management patterns to the GenAI ecosystem.

EdgeChains provides:
* **Just One Script File**: Simplify execution by pairing your application logic with a single Jsonnet configuration file.
* **Versioning for Prompts**: Treat prompts as code, making them easily versionable and diffable.
* **Automatic Parallelism**: Efficiently parallelize LLM chains across diverse compute resources.
* **Fault Tolerance**: Built-in retry and backoff mechanisms for resilient production pipelines.
* **Scalability**: Designed to handle large-scale API interactions, complex prompt chains, and massive vector datasets.

## Why Prompt & Chain Engineering Matters
Effective LLM integration requires more than simple API calls. We address critical challenges such as:
- **Prompt Explosion**: Managing variations across different LLM providers.
- **Prompt Drift**: Mitigating behavioral changes in models over time through declarative, externalized configurations.
- **Testability**: Enabling rapid iteration by keeping prompt logic outside of hard-coded application layers.
- **Token Management**: Built-in tracking to monitor and optimize costs associated with complex chain-of-thought operations.

---

# Setup
1. Clone the repository:
```bash
git clone https://github.com/arakoodev/EdgeChains/
cd EdgeChains
```

# Run the ChatWithPdf Example
1. Navigate to the example directory:
```bash
cd JS/edgechains/examples/chat-with-pdf/
npm install
```

2. Configure your `secrets.jsonnet`:
```jsonnet
{
  "supabase_api_key": "your_supabase_api_key",
  "supabase_url": "your_supabase_url",
  "openai_api_key": "your_openai_api_key",
}
```

3. Database Configuration
- Ensure a PostgreSQL Vector database is active in [Supabase](https://supabase.com/vector).
- Execute the following SQL in the Supabase SQL Editor:
```sql
create table if not exists documents (
    id bigint primary key generated always as identity,
    content text,
    embedding vector(1536)
);

create or replace function public.match_documents (
   query_embedding vector(1536), 
   similarity_threshold float, 
   match_count int
)
returns table (id bigint, content text, similarity float)
language sql
as $$
  select id, content, 1 - (documents.embedding <=> query_embedding) as similarity
  from documents
  where 1 - (documents.embedding <=> query_embedding) > similarity_threshold
  order by documents.embedding <=> query_embedding
  limit match_count;
$$;
```