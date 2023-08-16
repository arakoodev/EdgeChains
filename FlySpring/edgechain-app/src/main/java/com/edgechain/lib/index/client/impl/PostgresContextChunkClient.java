package com.edgechain.lib.index.client.impl;

import com.edgechain.lib.configuration.context.ApplicationContextHolder;
import com.edgechain.lib.embeddings.WordEmbeddings;
import com.edgechain.lib.endpoint.impl.PostgresEndpoint;
import com.edgechain.lib.index.domain.PostgresWordEmbeddings;
import com.edgechain.lib.index.enums.PostgresDistanceMetric;
import com.edgechain.lib.index.repositories.PostgresClientContextChunkRepository;
import com.edgechain.lib.response.StringResponse;
import com.edgechain.lib.rxjava.transformer.observable.EdgeChain;
import io.reactivex.rxjava3.core.Observable;
import org.springframework.stereotype.Service;

import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@Service
public class PostgresContextChunkClient {

  private PostgresEndpoint postgresEndpoint;
  private String namespace;

  private final PostgresClientContextChunkRepository repositoryContextChunk =
      ApplicationContextHolder.getContext().getBean(PostgresClientContextChunkRepository.class);

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
                  this.repositoryContextChunk.createTable(postgresEndpoint);

                  String contextRawText = postgresEndpoint.getContextChunkRawText().replaceAll("'", "");
                  //Get the context chunk id
                  Integer id = getContextChunkId(contextRawText);
                  if(id == null) {
                      this.repositoryContextChunk.upsertContextChunk(
                              postgresEndpoint.getContextChunkTableName(),
                              contextRawText
                      );
                      id = getContextChunkId(contextRawText);
                  }

                String input = wordEmbeddings.getId().replaceAll("'", "");

                // Upsert Embeddings
                  this.repositoryContextChunk.upsertEmbeddings(
                          postgresEndpoint.getTableName(),
                          input,
                          postgresEndpoint.getFilename(),
                          wordEmbeddings,
                          this.namespace,
                          id);

                emitter.onNext(new StringResponse("Upserted"));
                emitter.onComplete();

              } catch (final Exception e) {
                emitter.onError(e);
              }
            }),
        postgresEndpoint);
  }

  private Integer getContextChunkId(String contextRawText) {
      return this.repositoryContextChunk.queryContextTable(
              postgresEndpoint.getContextChunkTableName(),
              contextRawText
      );
  }

  public EdgeChain<List<PostgresWordEmbeddings>> query(
      WordEmbeddings wordEmbeddings, PostgresDistanceMetric metric, int topK, int probes) {

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
                          this.repositoryContextChunk.query(
                                  postgresEndpoint.getTableName(),
                                  postgresEndpoint.getContextChunkTableName(),
                                  this.namespace,
                                  probes,
                                  metric,
                                  wordEmbeddings,
                                  topK);

                List<PostgresWordEmbeddings> wordEmbeddingsList = new ArrayList<>();

                for (Map row : rows) {

                  PostgresWordEmbeddings val = new PostgresWordEmbeddings();
                  val.setId((String) row.get("id"));
                  val.setRawText((String) row.get("context_chunk"));
                  val.setFilename((String) row.get("filename"));
                  val.setTimestamp(((Timestamp) row.get("timestamp")).toLocalDateTime());
                  val.setNamespace((String) row.get("namespace"));
                  val.setScore((Double) row.get("score"));

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
}
