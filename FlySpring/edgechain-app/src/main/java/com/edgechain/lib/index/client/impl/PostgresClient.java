package com.edgechain.lib.index.client.impl;

import com.edgechain.lib.configuration.context.ApplicationContextHolder;
import com.edgechain.lib.embeddings.WordEmbeddings;
import com.edgechain.lib.endpoint.impl.PostgresEndpoint;
import com.edgechain.lib.index.enums.PostgresDistanceMetric;
import com.edgechain.lib.index.repositories.PostgresClientRepository;
import com.edgechain.lib.index.responses.PostgresResponse;
import com.edgechain.lib.response.StringResponse;
import com.edgechain.lib.rxjava.transformer.observable.EdgeChain;
import io.reactivex.rxjava3.core.Observable;

import java.sql.Timestamp;
import java.util.*;

public class PostgresClient {

  private final PostgresEndpoint postgresEndpoint;
  private final String namespace;

  private final PostgresClientRepository repository =
      ApplicationContextHolder.getContext().getBean(PostgresClientRepository.class);

  public PostgresClient(PostgresEndpoint postgresEndpoint) {
    this.postgresEndpoint = postgresEndpoint;
    this.namespace =
        (Objects.isNull(postgresEndpoint.getNamespace())
                || postgresEndpoint.getNamespace().isEmpty())
            ? "knowledge"
            : postgresEndpoint.getNamespace();
  }

  public EdgeChain<StringResponse> upsert(WordEmbeddings wordEmbeddings) {

    return new EdgeChain<>(
        Observable.create(
            emitter -> {
              try {
                // Create Table
                this.repository.createTable(postgresEndpoint);

                String input = wordEmbeddings.getId().replaceAll("'", "");

                // Upsert Embeddings
                this.repository.upsertEmbeddings(
                    postgresEndpoint.getTableName(), input, wordEmbeddings, this.namespace);

                emitter.onNext(new StringResponse("Upserted"));
                emitter.onComplete();

              } catch (final Exception e) {
                emitter.onError(e);
              }
            }),
        postgresEndpoint);
  }

  public EdgeChain<StringResponse> upsertWithFilename(WordEmbeddings wordEmbeddings) {

    return new EdgeChain<>(
        Observable.create(
            emitter -> {
              try {
                // Create Table
                this.repository.createTable(postgresEndpoint);

                String input = wordEmbeddings.getId().replaceAll("'", "");

                // Upsert Embeddings
                this.repository.upsertEmbeddingsWithFilename(
                    postgresEndpoint.getTableName(),
                    input,
                    wordEmbeddings,
                    this.namespace,
                    postgresEndpoint.getFileName());

                emitter.onNext(new StringResponse("Upserted"));
                emitter.onComplete();

              } catch (final Exception e) {
                emitter.onError(e);
              }
            }),
        postgresEndpoint);
  }

  public EdgeChain<List<WordEmbeddings>> query(
      WordEmbeddings wordEmbeddings, PostgresDistanceMetric metric, int topK) {
    return new EdgeChain<>(
        Observable.create(
            emitter -> {
              try {

                List<Map<String, Object>> rows =
                    this.repository.query(
                        postgresEndpoint.getTableName(),
                        this.namespace,
                        metric,
                        wordEmbeddings,
                        topK);

                List<WordEmbeddings> wordEmbeddingsList = new ArrayList<>();

                for (Map row : rows) {
                  wordEmbeddingsList.add(new WordEmbeddings((String) row.get("raw")));
                }

                emitter.onNext(wordEmbeddingsList);
                emitter.onComplete();

              } catch (final Exception e) {
                emitter.onError(e);
              }
            }),
        postgresEndpoint);
  }

  public EdgeChain<List<PostgresResponse>> queryWithFilename(
      WordEmbeddings wordEmbeddings, PostgresDistanceMetric metric, int topK) {

    return new EdgeChain<>(
        Observable.create(
            emitter -> {
              try {
                List<Map<String, Object>> rows =
                    this.repository.queryWithFilename(
                        postgresEndpoint.getTableName(),
                        this.namespace,
                        metric,
                        wordEmbeddings,
                        topK);

                List<PostgresResponse> wordEmbeddingsList = new ArrayList<>();

                for (Map row : rows) {
                  wordEmbeddingsList.add(
                      new PostgresResponse(
                          (String) row.get("id"),
                          new WordEmbeddings((String) row.get("raw")),
                          (String) row.get("filename"),
                          (Integer) row.get("sno"),
                          (Timestamp) row.get("timestamp")));
                }
                emitter.onNext(wordEmbeddingsList);
                emitter.onComplete();
              } catch (final Exception e) {
                emitter.onError(e);
              }
            }),
        postgresEndpoint);
  }

  public EdgeChain<StringResponse> deleteAll() {

    return new EdgeChain<>(
        Observable.create(
            emitter -> {
              try {
                this.repository.deleteAll(postgresEndpoint.getTableName(), this.namespace);
                emitter.onNext(
                    new StringResponse(
                        "Word embeddings are successfully deleted for namespace:"
                            + this.namespace));
                emitter.onComplete();
              } catch (final Exception e) {
                emitter.onError(e);
              }
            }),
        postgresEndpoint);
  }
}
