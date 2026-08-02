# PaLM 2 example

This example keeps the prompt template in `jsonnet/main.jsonnet` and supplies
the question at runtime.

```bash
PALM_API_KEY=your-key PALM2_QUESTION="What is a vector database?" npm start
```

The PaLM 2 REST API is a legacy API. New applications should use the Gemini
API, but this example remains available for projects that still need the
PaLM-compatible interface.
