package com.edgechain.lib.chains;

import com.edgechain.lib.embeddings.WordEmbeddings;
import com.edgechain.lib.endpoint.impl.embeddings.BgeSmallEndpoint;
import com.edgechain.lib.endpoint.impl.embeddings.MiniLMEndpoint;
import com.edgechain.lib.endpoint.impl.embeddings.OpenAiEmbeddingEndpoint;
import com.edgechain.lib.endpoint.impl.index.RedisEndpoint;
import com.edgechain.lib.index.enums.RedisDistanceMetric;
import com.edgechain.lib.request.ArkRequest;
import io.reactivex.rxjava3.core.Completable;
import io.reactivex.rxjava3.core.Observable;
import io.reactivex.rxjava3.schedulers.Schedulers;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;

public class RedisRetrieval {
  private final RedisEndpoint redisEndpoint;
  private final ArkRequest arkRequest;
  private final String[] arr;
  private final int dimension;
  private final RedisDistanceMetric metric;
  private int batchSize = 30;

  public RedisRetrieval(
      String[] arr,
      RedisEndpoint redisEndpoint,
      int dimension,
      RedisDistanceMetric metric,
      ArkRequest arkRequest) {
    this.redisEndpoint = redisEndpoint;
    this.dimension = dimension;
    this.metric = metric;
    this.arkRequest = arkRequest;
    this.arr = arr;

    Logger logger = LoggerFactory.getLogger(getClass());
    if (redisEndpoint.getEmbeddingEndpoint() instanceof OpenAiEmbeddingEndpoint openAiEndpoint)
      logger.info("Using OpenAi Embedding Service: " + openAiEndpoint.getModel());
    else if (redisEndpoint.getEmbeddingEndpoint() instanceof MiniLMEndpoint miniLMEndpoint)
      logger.info(String.format("Using %s", miniLMEndpoint.getMiniLMModel().getName()));
    else if (redisEndpoint.getEmbeddingEndpoint() instanceof BgeSmallEndpoint bgeSmallEndpoint)
      logger.info(String.format("Using BgeSmall: " + bgeSmallEndpoint.getModelUrl()));
  }

  public void upsert() {

    this.redisEndpoint.createIndex(redisEndpoint.getNamespace(), dimension, metric);

    Observable.fromArray(arr)
        .buffer(batchSize)
        .concatMapCompletable(
            batch ->
                Observable.fromIterable(batch)
                    .flatMap(
                        input ->
                            Observable.fromCallable(() -> generateEmbeddings(input))
                                .subscribeOn(Schedulers.io()))
                    .toList()
                    .flatMapCompletable(
                        wordEmbeddingsList ->
                            Completable.fromAction(() -> executeBatchUpsert(wordEmbeddingsList))
                                .subscribeOn(Schedulers.io())))
        .blockingAwait();
  }

  private WordEmbeddings generateEmbeddings(String input) {
    return redisEndpoint
        .getEmbeddingEndpoint()
        .embeddings(input, arkRequest)
        .firstOrError()
        .blockingGet();
  }

  private void executeBatchUpsert(List<WordEmbeddings> wordEmbeddingsList) {
    redisEndpoint.batchUpsert(wordEmbeddingsList);
  }

  public void setBatchSize(int batchSize) {
    this.batchSize = batchSize;
  }

  public int getBatchSize() {
    return batchSize;
  }
}
