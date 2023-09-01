package com.edgechain.lib.chains;

import com.edgechain.lib.embeddings.WordEmbeddings;
import com.edgechain.lib.endpoint.EmbeddingEndpoint;
import com.edgechain.lib.endpoint.impl.BgeSmallEndpoint;
import com.edgechain.lib.endpoint.impl.MiniLMEndpoint;
import com.edgechain.lib.endpoint.impl.OpenAiEndpoint;
import com.edgechain.lib.endpoint.impl.PineconeEndpoint;
import com.edgechain.lib.request.ArkRequest;
import io.reactivex.rxjava3.core.Completable;
import io.reactivex.rxjava3.core.Observable;
import io.reactivex.rxjava3.schedulers.Schedulers;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;

public class PineconeRetrieval  {

  private final PineconeEndpoint pineconeEndpoint;

  private final ArkRequest arkRequest;
  private final EmbeddingEndpoint embeddingEndpoint;

  private final String[] arr;

  private int batchSize = 50;

  public PineconeRetrieval(
          String[] arr, EmbeddingEndpoint embeddingEndpoint, PineconeEndpoint pineconeEndpoint,  ArkRequest arkRequest) {
    this.pineconeEndpoint = pineconeEndpoint;
    this.embeddingEndpoint = embeddingEndpoint;
    this.arkRequest = arkRequest;
    this.arr = arr;

    Logger logger = LoggerFactory.getLogger(getClass());
    if (embeddingEndpoint instanceof OpenAiEndpoint openAiEndpoint)
      logger.info("Using OpenAi Embedding Service: " + openAiEndpoint.getModel());
    else if (embeddingEndpoint instanceof MiniLMEndpoint miniLMEndpoint)
      logger.info(String.format("Using %s", miniLMEndpoint.getMiniLMModel().getName()));
    else if (embeddingEndpoint instanceof BgeSmallEndpoint bgeSmallEndpoint)
      logger.info(String.format("Using BgeSmall: " + bgeSmallEndpoint.getModelUrl()));
  }

  public void upsert() {
    Observable.fromArray(arr)
            .buffer(batchSize)
            .concatMapCompletable(batch -> Observable.fromIterable(batch)
                    .flatMap(input -> Observable.fromCallable(() -> generateEmbeddings(input)).subscribeOn(Schedulers.io()))
                    .buffer(batchSize / 2)
                    .flatMapCompletable(wordEmbeddingsList -> Completable.fromAction(() -> executeBatchUpsert(wordEmbeddingsList)).subscribeOn(Schedulers.io())))
            .blockingAwait();
  }

  private WordEmbeddings generateEmbeddings(String input) {
    return embeddingEndpoint.embeddings(input, arkRequest).firstOrError().blockingGet();
  }

  private void executeBatchUpsert(List<WordEmbeddings> wordEmbeddingsList) {
    pineconeEndpoint.batchUpsert(wordEmbeddingsList);
  }

  public int getBatchSize() {
    return batchSize;
  }

  public void setBatchSize(int batchSize) {
    this.batchSize = batchSize;
  }
}
