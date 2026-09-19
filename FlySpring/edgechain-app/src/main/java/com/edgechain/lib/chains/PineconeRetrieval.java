package com.edgechain.lib.chains;

import com.edgechain.lib.embeddings.WordEmbeddings;
import com.edgechain.lib.endpoint.impl.embeddings.BgeSmallEndpoint;
import com.edgechain.lib.endpoint.impl.embeddings.MiniLMEndpoint;
import com.edgechain.lib.endpoint.impl.embeddings.OpenAiEmbeddingEndpoint;
import com.edgechain.lib.endpoint.impl.index.PineconeEndpoint;
import com.edgechain.lib.request.ArkRequest;
import io.reactivex.rxjava3.core.Completable;
import io.reactivex.rxjava3.core.Observable;
import io.reactivex.rxjava3.schedulers.Schedulers;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;

public class PineconeRetrieval {

  private final PineconeEndpoint pineconeEndpoint;

  private final ArkRequest arkRequest;
  private final String[] arr;
  private String namespace;
  private int batchSize = 30;

  public PineconeRetrieval(
      String[] arr, PineconeEndpoint pineconeEndpoint, String namespace, ArkRequest arkRequest) {
    this.pineconeEndpoint = pineconeEndpoint;
    this.arkRequest = arkRequest;
    this.arr = arr;
    this.namespace = namespace;

    Logger logger = LoggerFactory.getLogger(getClass());
    if (pineconeEndpoint.getEmbeddingEndpoint() instanceof OpenAiEmbeddingEndpoint openAiEndpoint)
      logger.info("Using OpenAi Embedding Service: " + openAiEndpoint.getModel());
    else if (pineconeEndpoint.getEmbeddingEndpoint() instanceof MiniLMEndpoint miniLMEndpoint)
      logger.info(String.format("Using %s", miniLMEndpoint.getMiniLMModel().getName()));
    else if (pineconeEndpoint.getEmbeddingEndpoint() instanceof BgeSmallEndpoint bgeSmallEndpoint)
      logger.info(String.format("Using BgeSmall: " + bgeSmallEndpoint.getModelUrl()));
  }

  public void upsert() {
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
    return pineconeEndpoint
        .getEmbeddingEndpoint()
        .embeddings(input, arkRequest)
        .firstOrError()
        .blockingGet();
  }

  private void executeBatchUpsert(List<WordEmbeddings> wordEmbeddingsList) {
    pineconeEndpoint.batchUpsert(wordEmbeddingsList, this.namespace);
  }

  public int getBatchSize() {
    return batchSize;
  }

  public void setBatchSize(int batchSize) {
    this.batchSize = batchSize;
  }
}
