package com.edgechain.lib.index.client.impl;

import com.edgechain.lib.configuration.context.ApplicationContextHolder;
import com.edgechain.lib.embeddings.WordEmbeddings;
import com.edgechain.lib.endpoint.impl.PostgresEndpoint;
import com.edgechain.lib.index.domain.PostgresWordEmbeddings;
import com.edgechain.lib.index.enums.PostgresDistanceMetric;
import com.edgechain.lib.index.repositories.PostgresClientMetadataRepository;
import com.edgechain.lib.index.repositories.PostgresClientRepository;
import com.edgechain.lib.response.StringResponse;
import com.edgechain.lib.rxjava.transformer.observable.EdgeChain;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.reactivex.rxjava3.core.Observable;
import org.springframework.stereotype.Service;
import java.sql.Timestamp;
import java.util.*;
import org.postgresql.util.PGobject;

@Service
public class PostgresClient {

  private PostgresEndpoint postgresEndpoint;
  private String namespace;

  private final PostgresClientRepository repository =
      ApplicationContextHolder.getContext().getBean(PostgresClientRepository.class);
  private final PostgresClientMetadataRepository metadataRepository =
      ApplicationContextHolder.getContext().getBean(PostgresClientMetadataRepository.class);

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
  public EdgeChain<StringResponse> insertMetadata(WordEmbeddings wordEmbeddings) {

    return new EdgeChain<>(
        Observable.create(
            emitter -> {
              try {

                // Create Table
                this.metadataRepository.createTable(postgresEndpoint);

                String input = wordEmbeddings.getId().replaceAll("'", "");

                // Upsert Embeddings
                  this.metadataRepository.insertMetadata(
                          postgresEndpoint.getMetadataTableName(),
                          input,
                          wordEmbeddings,
                          postgresEndpoint.getMetadataDate());

                emitter.onNext(new StringResponse("Inserted"));
                emitter.onComplete();

              } catch (final Exception e) {
                emitter.onError(e);
              }
            }),
        postgresEndpoint);
  }

  public EdgeChain<StringResponse> insertIntoJoinTable(PostgresEndpoint postgresEndpoint) {
      return new EdgeChain<>(
              Observable.create(
                      emitter -> {
                          try {

                              this.metadataRepository.insertIntoJoinTable(postgresEndpoint);

                              emitter.onNext(new StringResponse("Inserted"));
                              emitter.onComplete();

                          } catch (final Exception e) {
                              emitter.onError(e);
                          }
                      }),
              postgresEndpoint);
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

                  List<PostgresWordEmbeddings> wordEmbeddingsList = new ArrayList<>();
                  System.out.println("\n\n\n BEFORE IF CHECK:" + postgresEndpoint.getMetadataTableName() + "\n\n\n");
                  if(postgresEndpoint.getMetadataTableName() == null) {
                    List<Map<String, Object>> rows =
                            this.repository.query(
                                    postgresEndpoint.getTableName(),
                                    this.namespace,
                                    probes,
                                    metric,
                                    wordEmbeddings,
                                    topK);


                    for (Map row : rows) {

                        PostgresWordEmbeddings val = new PostgresWordEmbeddings();
                        val.setId((String) row.get("id"));
                        val.setRawText((String) row.get("raw_text"));
                        val.setFilename((String) row.get("filename"));
                        val.setTimestamp(((Timestamp) row.get("timestamp")).toLocalDateTime());
                        val.setNamespace((String) row.get("namespace"));
                        val.setScore((Double) row.get("score"));

                        wordEmbeddingsList.add(val);
                    }
                } else { //If the metadata table is not null, then we need to query with metadata
                      System.out.println("\n\n\n INSIDE THE ELSE OF POSTGRES CLIENT \n\n\n");
                      List<Map<String, Object>> rows = this.metadataRepository.queryWithMetadata(
                              postgresEndpoint.getTableName(),
                              postgresEndpoint.getMetadataTableName(),
                              this.namespace,
                              probes,
                              metric,
                              wordEmbeddings,
                              topK
                      );
                      for (Map row : rows) {

                          PostgresWordEmbeddings val = new PostgresWordEmbeddings();
                          val.setId((String) row.get("id"));
                          val.setRawText((String) row.get("raw_text"));
                          val.setFilename((String) row.get("filename"));
                          val.setTimestamp(((Timestamp) row.get("timestamp")).toLocalDateTime());
                          val.setNamespace((String) row.get("namespace"));
                          val.setScore((Double) row.get("score"));

                          //Add metadata fields in response
                          val.setMetadata((String) row.get("metadata"));
                          val.setMetadataDate(((Timestamp) row.get("document_date")).toLocalDateTime());

                          wordEmbeddingsList.add(val);
                      }
                  }

                emitter.onNext(wordEmbeddingsList);
                emitter.onComplete();

              } catch (final Exception e) {
                emitter.onError(e);
              }
            }),
        postgresEndpoint);
  }

  public EdgeChain<List<PostgresWordEmbeddings>> getAllChunks(PostgresEndpoint postgresEndpoint) {
      ObjectMapper objectMapper = new ObjectMapper();
      return new EdgeChain<>(
              Observable.create(
                      emitter -> {
                          try {
                              List<PostgresWordEmbeddings> wordEmbeddingsList = new ArrayList<>();
                              List<Map<String, Object>> rows = this.repository.getAllChunks(postgresEndpoint);
                              for(Map<String, Object> row: rows) {
//                                  System.out.println("\n\n\n Get all chunks: row:" + row + "\n\n\n");
                                  PostgresWordEmbeddings val = new PostgresWordEmbeddings();
                                  val.setEmbedding_id((Integer) row.get("embedding_id"));
                                  val.setRawText((String) row.get("raw_text"));
                                  PGobject pgObject = (PGobject) row.get("embedding");
                                  String jsonString = pgObject.getValue();
                                  List<Float> values = objectMapper.readValue(jsonString, new TypeReference<>() {
                                  });
                                  val.setValues(values);
                                  wordEmbeddingsList.add(val);
                              }
                              emitter.onNext(wordEmbeddingsList);
                              emitter.onComplete();
                          } catch (final Exception e) {
                              emitter.onError(e);
                          }
                      }
              ),
              postgresEndpoint
      );
  }

    public EdgeChain<List<PostgresWordEmbeddings>> similaritySearchMetadata(
            WordEmbeddings wordEmbeddings, PostgresDistanceMetric metric, int topK) {

        return new EdgeChain<>(
                Observable.create(
                        emitter -> {
                            try {
                                List<PostgresWordEmbeddings> wordEmbeddingsList = new ArrayList<>();
                                List<Map<String, Object>> rows = this.metadataRepository.similaritySearchMetadata(
                                        postgresEndpoint.getMetadataTableName(),
                                        metric,
                                        wordEmbeddings,
                                        topK
                                );
                                    for (Map row : rows) {

                                        PostgresWordEmbeddings val = new PostgresWordEmbeddings();
                                        val.setMetadataId((Integer) row.get("metadata_id"));
                                        val.setRawText((String) row.get("metadata"));
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
