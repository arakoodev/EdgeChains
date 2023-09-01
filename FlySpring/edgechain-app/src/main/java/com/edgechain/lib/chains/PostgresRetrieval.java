package com.edgechain.lib.chains;

import com.edgechain.lib.embeddings.WordEmbeddings;
import com.edgechain.lib.endpoint.EmbeddingEndpoint;
import com.edgechain.lib.endpoint.impl.PostgresEndpoint;
import com.edgechain.lib.index.enums.PostgresDistanceMetric;
import com.edgechain.lib.request.ArkRequest;
import com.edgechain.lib.response.StringResponse;
import io.reactivex.rxjava3.core.Completable;
import io.reactivex.rxjava3.core.Observable;
import io.reactivex.rxjava3.schedulers.Schedulers;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.*;
import java.util.stream.Collectors;


public class PostgresRetrieval {

    private int batchSize = 30;

    private final String[] arr;

    private final String filename;

    private final ArkRequest arkRequest;

    private final PostgresEndpoint postgresEndpoint;
    private final EmbeddingEndpoint embeddingEndpoint;

    private final int dimensions;
    private final PostgresDistanceMetric metric;
    private final int lists;

    public PostgresRetrieval(String[] arr, EmbeddingEndpoint embeddingEndpoint, PostgresEndpoint postgresEndpoint, int dimensions, PostgresDistanceMetric metric, int lists, String filename, ArkRequest arkRequest) {
        this.arr = arr;
        this.filename = filename;
        this.arkRequest = arkRequest;
        this.postgresEndpoint = postgresEndpoint;
        this.embeddingEndpoint = embeddingEndpoint;

        this.dimensions = dimensions;
        this.metric = metric;
        this.lists = lists;

    }


    public PostgresRetrieval(String[] arr, EmbeddingEndpoint embeddingEndpoint, PostgresEndpoint postgresEndpoint, int dimensions, String filename, ArkRequest arkRequest) {
        this.arr = arr;
        this.filename = filename;
        this.arkRequest = arkRequest;
        this.postgresEndpoint = postgresEndpoint;
        this.embeddingEndpoint = embeddingEndpoint;

        this.dimensions = dimensions;
        this.metric = PostgresDistanceMetric.COSINE;
        this.lists = 1000;
    }

    public List<String> upsert() {

        // Create Table...
        this.postgresEndpoint.createTable(dimensions, metric, lists);

        ConcurrentLinkedQueue<String> uuidQueue = new ConcurrentLinkedQueue<>();

        CountDownLatch latch = new CountDownLatch(1);

        Observable.fromArray(arr)
                .flatMap(input -> Observable.fromCallable(() -> generateEmbeddings(input))
                        .subscribeOn(Schedulers.io()))
                .buffer(batchSize)
                .flatMapCompletable(wordEmbeddingsList ->
                        Completable.fromAction(() -> upsertAndCollectIds(wordEmbeddingsList, uuidQueue))
                                .subscribeOn(Schedulers.io())
                )
                .blockingSubscribe(latch::countDown, error -> latch.countDown());

        return new ArrayList<>(uuidQueue);
    }

    private WordEmbeddings generateEmbeddings(String input) {
        return embeddingEndpoint.embeddings(input, arkRequest).firstOrError().blockingGet();
    }

    private void upsertAndCollectIds(List<WordEmbeddings> wordEmbeddingsList, ConcurrentLinkedQueue<String> uuidQueue) {
        List<String> batchUuidList = executeBatchUpsert(wordEmbeddingsList);
        uuidQueue.addAll(batchUuidList);
    }

    private List<String> executeBatchUpsert(List<WordEmbeddings> wordEmbeddingsList) {
        return this.postgresEndpoint.upsert(wordEmbeddingsList, filename).stream()
                .map(StringResponse::getResponse).collect(Collectors.toList());
    }
    public List<String> insertMetadata() {

        // Create Table...
        this.postgresEndpoint.createMetadataTable(dimensions, metric, lists);

        ConcurrentLinkedQueue<String> uuidQueue = new ConcurrentLinkedQueue<>();

        CountDownLatch latch = new CountDownLatch(1);

        Observable.fromArray(arr)
                .flatMap(input -> Observable.fromCallable(() -> generateEmbeddings(input))
                        .subscribeOn(Schedulers.io()))
                .buffer(batchSize)
                .flatMapCompletable(wordEmbeddingsList ->
                        Completable.fromAction(() -> insertMetadataAndCollectIds(wordEmbeddingsList, uuidQueue))
                                .subscribeOn(Schedulers.io())
                )
                .blockingSubscribe(latch::countDown, error -> latch.countDown());

        return new ArrayList<>(uuidQueue);
    }

    public StringResponse insertOneMetadata(String metadata) {
        // Create Table...
        this.postgresEndpoint.createMetadataTable(dimensions, metric, lists);
        WordEmbeddings wordEmbeddings = generateEmbeddings(metadata);
        return this.postgresEndpoint.insertMetadata(wordEmbeddings, dimensions, metric);
    }

    private void insertMetadataAndCollectIds(List<WordEmbeddings> wordEmbeddingsList, ConcurrentLinkedQueue<String> uuidQueue) {
        List<String> batchUuidList = executeBatchInsertMetadata(wordEmbeddingsList);
        uuidQueue.addAll(batchUuidList);
    }

    private List<String> executeBatchInsertMetadata(List<WordEmbeddings> wordEmbeddingsList) {
        return this.postgresEndpoint.batchInsertMetadata(wordEmbeddingsList).stream()
                .map(StringResponse::getResponse).collect(Collectors.toList());
    }


    public int getBatchSize() {
        return batchSize;
    }

    public void setBatchSize(int batchSize) {
        this.batchSize = batchSize;
    }

}
