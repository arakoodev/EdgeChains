package com.edgechain.lib.chains;

import com.edgechain.lib.embeddings.WordEmbeddings;
import com.edgechain.lib.endpoint.impl.embeddings.BgeSmallEndpoint;
import com.edgechain.lib.endpoint.impl.embeddings.MiniLMEndpoint;
import com.edgechain.lib.endpoint.impl.embeddings.OpenAiEmbeddingEndpoint;
import com.edgechain.lib.endpoint.impl.index.PostgresEndpoint;
import com.edgechain.lib.index.enums.PostgresDistanceMetric;
import com.edgechain.lib.index.enums.PostgresLanguage;
import com.edgechain.lib.request.ArkRequest;
import com.edgechain.lib.response.StringResponse;
import io.reactivex.rxjava3.core.Completable;
import io.reactivex.rxjava3.core.Observable;
import io.reactivex.rxjava3.schedulers.Schedulers;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.*;
import java.util.stream.Collectors;

public class PostgresRetrieval {

  private final Logger logger = LoggerFactory.getLogger(this.getClass());

  private int batchSize = 30;

  private final String[] arr;

  private final String filename;

  private final PostgresLanguage postgresLanguage;

  private final ArkRequest arkRequest;

  private final PostgresEndpoint postgresEndpoint;
  private final int dimensions;
  private final PostgresDistanceMetric metric;
  private final int lists;

  public PostgresRetrieval(
      String[] arr,
      PostgresEndpoint postgresEndpoint,
      int dimensions,
      PostgresDistanceMetric metric,
      int lists,
      String filename,
      PostgresLanguage postgresLanguage,
      ArkRequest arkRequest) {
    this.arr = arr;
    this.filename = filename;
    this.postgresEndpoint = postgresEndpoint;
    this.postgresLanguage = postgresLanguage;
    this.arkRequest = arkRequest;

    this.dimensions = dimensions;
    this.metric = metric;
    this.lists = lists;

    if (postgresEndpoint.getEmbeddingEndpoint() instanceof OpenAiEmbeddingEndpoint openAiEndpoint)
      logger.info("Using OpenAi Embedding Service: " + openAiEndpoint.getModel());
    else if (postgresEndpoint.getEmbeddingEndpoint() instanceof MiniLMEndpoint miniLMEndpoint)
      logger.info(String.format("Using %s", miniLMEndpoint.getMiniLMModel().getName()));
    else if (postgresEndpoint.getEmbeddingEndpoint() instanceof BgeSmallEndpoint bgeSmallEndpoint)
      logger.info(String.format("Using BgeSmall: " + bgeSmallEndpoint.getModelUrl()));
  }

  public PostgresRetrieval(
      String[] arr,
      PostgresEndpoint postgresEndpoint,
      int dimensions,
      String filename,
      PostgresLanguage postgresLanguage,
      ArkRequest arkRequest) {
    this.arr = arr;
    this.filename = filename;
    this.postgresLanguage = postgresLanguage;
    this.postgresEndpoint = postgresEndpoint;
    this.dimensions = dimensions;
    this.metric = PostgresDistanceMetric.COSINE;
    this.lists = 1000;
    this.arkRequest = arkRequest;

    if (postgresEndpoint.getEmbeddingEndpoint() instanceof OpenAiEmbeddingEndpoint openAiEndpoint)
      logger.info("Using OpenAi Embedding Service: " + openAiEndpoint.getModel());
    else if (postgresEndpoint.getEmbeddingEndpoint() instanceof MiniLMEndpoint miniLMEndpoint)
      logger.info(String.format("Using %s", miniLMEndpoint.getMiniLMModel().getName()));
    else if (postgresEndpoint.getEmbeddingEndpoint() instanceof BgeSmallEndpoint bgeSmallEndpoint)
      logger.info(String.format("Using BgeSmall: " + bgeSmallEndpoint.getModelUrl()));
  }

  public List<String> upsert() {

    // Create Table...
    this.postgresEndpoint.createTable(dimensions, metric, lists);

    ConcurrentLinkedQueue<String> uuidQueue = new ConcurrentLinkedQueue<>();

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
                            Completable.fromAction(
                                    () -> upsertAndCollectIds(wordEmbeddingsList, uuidQueue))
                                .subscribeOn(Schedulers.io())))
        .blockingAwait();

    return new ArrayList<>(uuidQueue);
  }

  private WordEmbeddings generateEmbeddings(String input) {
    return postgresEndpoint
        .getEmbeddingEndpoint()
        .embeddings(input, arkRequest)
        .firstOrError()
        .blockingGet();
  }

  private void upsertAndCollectIds(
      List<WordEmbeddings> wordEmbeddingsList, ConcurrentLinkedQueue<String> uuidQueue) {
    List<String> batchUuidList = executeBatchUpsert(wordEmbeddingsList);
    uuidQueue.addAll(batchUuidList);
  }

  private List<String> executeBatchUpsert(List<WordEmbeddings> wordEmbeddingsList) {
    return this.postgresEndpoint.upsert(wordEmbeddingsList, filename, postgresLanguage).stream()
        .map(StringResponse::getResponse)
        .collect(Collectors.toList());
  }

  public List<String> insertMetadata(String metadataTableName) {

    // Create Table...
    this.postgresEndpoint.createMetadataTable(metadataTableName);

    ConcurrentLinkedQueue<String> uuidQueue = new ConcurrentLinkedQueue<>();

    CountDownLatch latch = new CountDownLatch(1);

    Observable.fromArray(arr)
        .map(str -> str.replaceAll("'", ""))
        .buffer(batchSize)
        .flatMapCompletable(
            metadataList ->
                Completable.fromAction(() -> insertMetadataAndCollectIds(metadataList, uuidQueue)))
        .blockingSubscribe(latch::countDown, error -> latch.countDown());

    return new ArrayList<>(uuidQueue);
  }

  public StringResponse insertOneMetadata(
      String metadataTableName, String metadata, String documentDate) {
    // Create Table...
    this.postgresEndpoint.createMetadataTable(metadataTableName);
    return this.postgresEndpoint.insertMetadata(metadataTableName, metadata, documentDate);
  }

  private void insertMetadataAndCollectIds(
      List<String> metadataList, ConcurrentLinkedQueue<String> uuidQueue) {
    List<String> batchUuidList = executeBatchInsertMetadata(metadataList);
    uuidQueue.addAll(batchUuidList);
  }

  private List<String> executeBatchInsertMetadata(List<String> metadataList) {
    return this.postgresEndpoint.batchInsertMetadata(metadataList).stream()
        .map(StringResponse::getResponse)
        .collect(Collectors.toList());
  }

  public int getBatchSize() {
    return batchSize;
  }

  public void setBatchSize(int batchSize) {
    this.batchSize = batchSize;
  }
}
