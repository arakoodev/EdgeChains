local secrets = import './secrets.jsonnet';

{
  collectionName: "edgechains_knowledge_base",
  vectorDimension: 1536,
  distanceMetric: "Cosine",
  qdrantUrl: secrets.qdrant_url,
  qdrantApiKey: secrets.qdrant_api_key,
}
