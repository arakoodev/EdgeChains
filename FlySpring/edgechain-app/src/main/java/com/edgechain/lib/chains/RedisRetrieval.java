package com.edgechain.lib.chains;

import com.edgechain.lib.endpoint.impl.OpenAiEndpoint;
import com.edgechain.lib.endpoint.impl.RedisEndpoint;
import com.edgechain.lib.index.enums.RedisDistanceMetric;
import com.edgechain.lib.rxjava.transformer.observable.EdgeChain;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class RedisRetrieval extends Retrieval {

  private Logger logger = LoggerFactory.getLogger(getClass());

  private final RedisEndpoint redisEndpoint;
  private OpenAiEndpoint openAiEndpoint;

  private final int dimension;
  private final RedisDistanceMetric metric;


  public RedisRetrieval(RedisEndpoint redisEndpoint, OpenAiEndpoint openAiEndpoint, int dimension, RedisDistanceMetric metric) {
    this.redisEndpoint = redisEndpoint;
    this.openAiEndpoint = openAiEndpoint;
    this.dimension = dimension;
    this.metric = metric;
    logger.info("Using OpenAI Embedding Service");
  }

  public RedisRetrieval(RedisEndpoint redisEndpoint,int dimension, RedisDistanceMetric metric) {
    this.redisEndpoint = redisEndpoint;
    this.dimension = dimension;
    this.metric = metric;
    logger.info("Using Doc2Vec Embedding Service");
  }

  @Override
  public void upsert(String input) {

    if (openAiEndpoint != null) {
      new EdgeChain<>(
              this.openAiEndpoint
                      .getEmbeddings(input)
                      .map(embeddings -> this.redisEndpoint.upsert(embeddings,dimension,metric)))
              .awaitWithoutRetry();
    }
    // For Doc2Vec ===>
  }
}
