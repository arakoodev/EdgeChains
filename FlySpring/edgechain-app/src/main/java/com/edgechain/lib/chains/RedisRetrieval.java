package com.edgechain.lib.chains;

import com.edgechain.lib.endpoint.impl.Doc2VecEndpoint;
import com.edgechain.lib.endpoint.impl.OpenAiEndpoint;
import com.edgechain.lib.endpoint.impl.RedisEndpoint;
import com.edgechain.lib.index.enums.RedisDistanceMetric;
import com.edgechain.lib.rxjava.transformer.observable.EdgeChain;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.Objects;

public class RedisRetrieval extends Retrieval {

  private final Logger logger = LoggerFactory.getLogger(getClass());

  private final RedisEndpoint redisEndpoint;
  private OpenAiEndpoint openAiEndpoint;

  private Doc2VecEndpoint doc2VecEndpoint;

  private final int dimension;
  private final RedisDistanceMetric metric;

  public RedisRetrieval(
      RedisEndpoint redisEndpoint,
      OpenAiEndpoint openAiEndpoint,
      int dimension,
      RedisDistanceMetric metric) {
    this.redisEndpoint = redisEndpoint;
    this.openAiEndpoint = openAiEndpoint;
    this.dimension = dimension;
    this.metric = metric;
    logger.info("Using OpenAI Embedding Service");
  }

  public RedisRetrieval(
      RedisEndpoint redisEndpoint,
      Doc2VecEndpoint doc2VecEndpoint,
      int dimension,
      RedisDistanceMetric metric) {
    this.redisEndpoint = redisEndpoint;
    this.doc2VecEndpoint = doc2VecEndpoint;
    this.dimension = dimension;
    this.metric = metric;
    logger.info("Using Doc2Vec Embedding Service");
  }

  @Override
  public void upsert(String input) {

    if (Objects.nonNull(openAiEndpoint)) {
      new EdgeChain<>(
              this.openAiEndpoint
                  .getEmbeddings(input)
                  .map(embeddings -> this.redisEndpoint.upsert(embeddings, dimension, metric))
                  .firstOrError()
                  .blockingGet())
          .await()
          .blockingAwait();
    }
    // For Doc2Vec ===>

    if (Objects.nonNull(doc2VecEndpoint)) {
      new EdgeChain<>(
              this.doc2VecEndpoint
                  .getEmbeddings(input)
                  .map(embeddings -> this.redisEndpoint.upsert(embeddings, dimension, metric))
                  .firstOrError()
                  .blockingGet())
          .await()
          .blockingAwait();
    }
  }
}
