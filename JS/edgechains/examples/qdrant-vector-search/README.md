# Qdrant Vector Database Integration for EdgeChains

This example demonstrates how to integrate **Qdrant** with EdgeChains for high-performance vector similarity search, document indexing, and payload filtering.

The implementation uses EdgeChains' pure REST connector with zero external Qdrant SDK dependencies.

## Features

- **Zero-Dependency REST Client**: Pure HTTP/REST with automatic retry and exponential backoff.
- **Collection Management**: Create, verify, inspect, and delete vector collections with configurable dimensions and distance metrics (`Cosine`, `Euclid`, `Dot`, `Manhattan`).
- **Batch & Single Upsert**: Supports batch vector point upserts and standard `{ content, embedding }` single-point insertion compatible with EdgeChains Supabase patterns.
- **Dense Vector Search**: Semantic similarity search with score threshold and boolean filtering.
- **Full CRUD Support**: `insertVectorData`, `getDataFromQuery` (search), `getData` (scroll), `getDataById`, `updateById`, and `deleteById`.

## Configuration

Set the environment variables (or pass them explicitly):

```bash
export QDRANT_URL="http://localhost:6333"
export QDRANT_API_KEY="" # Optional for local instances
```

## Running the Example

```bash
cd JS/edgechains/examples/qdrant-vector-search
npm install
npm start
```
