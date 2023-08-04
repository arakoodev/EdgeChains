package com.edgechain.lib.index.client.impl;

import com.edgechain.lib.configuration.context.ApplicationContextHolder;
import com.edgechain.lib.embeddings.WordEmbeddings;
import com.edgechain.lib.endpoint.impl.PostgresEndpoint;
import com.edgechain.lib.index.domain.PostgresWordEmbeddings;
import com.edgechain.lib.index.enums.PostgresDistanceMetric;
import com.edgechain.lib.index.repositories.PostgresClientRepository;
import com.edgechain.lib.response.StringResponse;
import com.edgechain.lib.rxjava.transformer.observable.EdgeChain;
import io.reactivex.rxjava3.core.Observable;
import org.springframework.stereotype.Service;

import java.sql.Timestamp;
import java.util.*;

@Service
public class PostgresClient {

  private PostgresEndpoint postgresEndpoint;
  private String namespace;

  private final PostgresClientRepository repository =
      ApplicationContextHolder.getContext().getBean(PostgresClientRepository.class);

  public PostgresEndpoint getPostgresEndpoint() {
    return postgresEndpoint;
  }

  public void setPostgresEndpoint(PostgresEndpoint postgresEndpoint) {
    this.postgresEndpoint = postgresEndpoint;
  }

  public String getNamespace() {
    return namespace;
  }

  public void setNamespace(String namespace) {
    this.namespace = namespace;
  }

  public EdgeChain<StringResponse> upsert(WordEmbeddings wordEmbeddings) {

    return new EdgeChain<>(
        Observable.create(
            emitter -> {
              try {

                this.namespace =
                    (Objects.isNull(postgresEndpoint.getNamespace())
                            || postgresEndpoint.getNamespace().isEmpty())
                        ? "knowledge"
                        : postgresEndpoint.getNamespace();

                // Create Table
                this.repository.createTable(postgresEndpoint);

                String input = wordEmbeddings.getId().replaceAll("'", "");

                // Upsert Embeddings
                this.repository.upsertEmbeddings(
                    postgresEndpoint.getTableName(),
                    input,
                    postgresEndpoint.getFilename(),
                    wordEmbeddings,
                    this.namespace);

                emitter.onNext(new StringResponse("Upserted"));
                emitter.onComplete();

              } catch (final Exception e) {
                emitter.onError(e);
              }
            }),
        postgresEndpoint);
  }

  public EdgeChain<List<PostgresWordEmbeddings>> query(
      WordEmbeddings wordEmbeddings, PostgresDistanceMetric metric, int topK) {

    return new EdgeChain<>(
        Observable.create(
            emitter -> {
              try {
                this.namespace =
                    (Objects.isNull(postgresEndpoint.getNamespace())
                            || postgresEndpoint.getNamespace().isEmpty())
                        ? "knowledge"
                        : postgresEndpoint.getNamespace();

                List<Map<String, Object>> rows =
                    this.repository.query(
                        postgresEndpoint.getTableName(),
                        this.namespace,
                        metric,
                        wordEmbeddings,
                        topK);

                List<PostgresWordEmbeddings> wordEmbeddingsList = new ArrayList<>();

                for (Map row : rows) {

                  PostgresWordEmbeddings val = new PostgresWordEmbeddings();
                  val.setId((String) row.get("id"));
                  val.setRawText((String) row.get("raw_text"));
                  val.setFilename((String) row.get("filename"));
                  val.setTimestamp(((Timestamp) row.get("timestamp")).toLocalDateTime());
                  val.setNamespace((String) row.get("namespace"));

                  wordEmbeddingsList.add(val);
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
              this.namespace =
                  (Objects.isNull(postgresEndpoint.getNamespace())
                          || postgresEndpoint.getNamespace().isEmpty())
                      ? "knowledge"
                      : postgresEndpoint.getNamespace();

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
