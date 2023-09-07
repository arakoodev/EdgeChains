package com.edgechain.lib.index.client.impl;

import com.edgechain.lib.configuration.context.ApplicationContextHolder;
import com.edgechain.lib.endpoint.impl.PostgresEndpoint;
import com.edgechain.lib.index.domain.PostgresWordEmbeddings;
import com.edgechain.lib.index.repositories.PostgresClientMetadataRepository;
import com.edgechain.lib.index.repositories.PostgresClientRepository;
import com.edgechain.lib.response.StringResponse;
import com.edgechain.lib.rxjava.transformer.observable.EdgeChain;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.reactivex.rxjava3.core.Observable;
import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import org.postgresql.util.PGobject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class PostgresClient {

  private static final Logger logger = LoggerFactory.getLogger(PostgresClient.class);

  private static final TypeReference<List<Float>> FLOAT_TYPE_REF = new TypeReference<>() {};

  private final PostgresClientRepository repository =
      ApplicationContextHolder.getContext().getBean(PostgresClientRepository.class);
  private final PostgresClientMetadataRepository metadataRepository =
      ApplicationContextHolder.getContext().getBean(PostgresClientMetadataRepository.class);

  private final ObjectMapper objectMapper = new ObjectMapper();

  public EdgeChain<StringResponse> createTable(PostgresEndpoint postgresEndpoint) {
    return new EdgeChain<>(
        Observable.create(
            emitter -> {
              try {
                this.repository.createTable(postgresEndpoint);
                emitter.onNext(new StringResponse("Table: " + postgresEndpoint.getTableName()));
                emitter.onComplete();
              } catch (final Exception e) {
                emitter.onError(e);
              }
            }));
  }

  public EdgeChain<StringResponse> createMetadataTable(PostgresEndpoint postgresEndpoint) {
    return new EdgeChain<>(
        Observable.create(
            emitter -> {
              try {
                this.metadataRepository.createTable(postgresEndpoint);
                emitter.onNext(
                    new StringResponse(
                        "Table: " + postgresEndpoint.getMetadataTableNames().get(0)));
                emitter.onComplete();
              } catch (final Exception e) {
                emitter.onError(e);
              }
            }));
  }

  public EdgeChain<List<StringResponse>> batchUpsert(PostgresEndpoint postgresEndpoint) {

    return new EdgeChain<>(
        Observable.create(
            emitter -> {
              try {

                // Upsert Embeddings
                List<String> strings =
                    this.repository.batchUpsertEmbeddings(
                        postgresEndpoint.getTableName(),
                        postgresEndpoint.getWordEmbeddingsList(),
                        postgresEndpoint.getFilename(),
                        getNamespace(postgresEndpoint));

                List<StringResponse> stringResponseList =
                    strings.stream().map(StringResponse::new).toList();

                emitter.onNext(stringResponseList);
                emitter.onComplete();

              } catch (final Exception e) {
                emitter.onError(e);
              }
            }),
        postgresEndpoint);
  }

  public EdgeChain<StringResponse> upsert(PostgresEndpoint postgresEndpoint) {

    return new EdgeChain<>(
        Observable.create(
            emitter -> {
              try {

                // Upsert Embeddings
                String embeddingId =
                    this.repository.upsertEmbeddings(
                        postgresEndpoint.getTableName(),
                        postgresEndpoint.getWordEmbedding(),
                        postgresEndpoint.getFilename(),
                        getNamespace(postgresEndpoint));

                emitter.onNext(new StringResponse(embeddingId));
                emitter.onComplete();

              } catch (final Exception e) {
                emitter.onError(e);
              }
            }),
        postgresEndpoint);
  }

  public EdgeChain<StringResponse> insertMetadata(PostgresEndpoint postgresEndpoint) {

    return new EdgeChain<>(
        Observable.create(
            emitter -> {
              try {
                String metadata = postgresEndpoint.getMetadata();
                String input = metadata.replace("'", "");

                String metadataId =
                    this.metadataRepository.insertMetadata(
                        postgresEndpoint.getMetadataTableNames().get(0),
                        input,
                        postgresEndpoint.getDocumentDate());

                emitter.onNext(new StringResponse(metadataId));
                emitter.onComplete();

              } catch (final Exception e) {
                emitter.onError(e);
              }
            }),
        postgresEndpoint);
  }

  public EdgeChain<List<StringResponse>> batchInsertMetadata(PostgresEndpoint postgresEndpoint) {

    return new EdgeChain<>(
        Observable.create(
            emitter -> {
              try {

                // Insert metadata
                List<String> strings =
                    this.metadataRepository.batchInsertMetadata(
                        postgresEndpoint.getMetadataTableNames().get(0),
                        postgresEndpoint.getMetadataList());

                List<StringResponse> stringResponseList =
                    strings.stream().map(StringResponse::new).toList();

                emitter.onNext(stringResponseList);
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

  public EdgeChain<List<PostgresWordEmbeddings>> query(PostgresEndpoint postgresEndpoint) {

    return new EdgeChain<>(
        Observable.create(
            emitter -> {
              try {
                List<PostgresWordEmbeddings> wordEmbeddingsList = new ArrayList<>();
                List<Map<String, Object>> rows =
                    this.repository.query(
                        postgresEndpoint.getTableName(),
                        getNamespace(postgresEndpoint),
                        postgresEndpoint.getProbes(),
                        postgresEndpoint.getMetric(),
                        postgresEndpoint.getWordEmbedding().getValues(),
                        postgresEndpoint.getTopK());

                for (Map<String, Object> row : rows) {

                  PostgresWordEmbeddings val = new PostgresWordEmbeddings();
                  val.setId(row.get("id").toString());
                  val.setRawText((String) row.get("raw_text"));
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

  public EdgeChain<List<PostgresWordEmbeddings>> queryWithMetadata(
      PostgresEndpoint postgresEndpoint) {

    return new EdgeChain<>(
        Observable.create(
            emitter -> {
              try {
                List<PostgresWordEmbeddings> wordEmbeddingsList = new ArrayList<>();
                if (postgresEndpoint.getMetadataTableNames() != null) {
                  try {
                    List<String> metadataTableNames = postgresEndpoint.getMetadataTableNames();
                    int numberOfMetadataTables = metadataTableNames.size();

                    /*
                     * This map will store the <id, titleMetadata> pairs
                     * We need to extract the title info from another metadata table.
                     * So instead of having extra PostgresWordEmbeddings objects for the title info
                     * We can store the title info in a map corresponding to the id key of the embeddings table
                     * Then after the loop is over we can inject the title field in the correct PostgresWordEmbeddings object by using the id key.
                     */
                    Map<String, String> titleMetadataMap = new HashMap<>();
                    Map<String, String> dateMetadataMap = new HashMap<>();
                    for (String metadataTableName : metadataTableNames) {
                      List<Map<String, Object>> rows =
                          this.metadataRepository.queryWithMetadata(
                              postgresEndpoint.getTableName(),
                              metadataTableName,
                              getNamespace(postgresEndpoint),
                              postgresEndpoint.getProbes(),
                              postgresEndpoint.getMetric(),
                              postgresEndpoint.getWordEmbedding().getValues(),
                              postgresEndpoint.getTopK());

                      // To filter out duplicate context chunks
                      Set<String> contextChunkIds = new HashSet<>();
                      for (Map<String, Object> row : rows) {
                        String metadataId = row.get("metadata_id").toString();
                        if (!metadataTableName.contains("_title_metadata")
                            && contextChunkIds.contains(metadataId)) continue;

                        PostgresWordEmbeddings val = new PostgresWordEmbeddings();
                        final String idStr = row.get("id").toString();
                        val.setId(idStr);
                        val.setRawText((String) row.get("raw_text"));
                        val.setFilename((String) row.get("filename"));
                        val.setTimestamp(((Timestamp) row.get("timestamp")).toLocalDateTime());
                        val.setNamespace((String) row.get("namespace"));
                        val.setScore((Double) row.get("score"));

                        // Add metadata fields in response
                        if (metadataTableName.contains("_title_metadata")) {
                          titleMetadataMap.put(idStr, (String) row.get("metadata"));
                          dateMetadataMap.put(idStr, (String) row.get("document_date"));

                          // For checking if only one metadata table is present which is the title
                          // table
                          if (numberOfMetadataTables > 1) continue;
                        } else {
                          val.setMetadata((String) row.get("metadata"));
                        }
                        contextChunkIds.add(metadataId);
                        wordEmbeddingsList.add(val);
                      }

                      // Insert the title and date fields into their respective
                      // PostgresWordEmbeddings
                      for (PostgresWordEmbeddings wordEmbedding : wordEmbeddingsList) {
                        String id = wordEmbedding.getId();
                        if (titleMetadataMap.containsKey(id)) {
                          wordEmbedding.setTitleMetadata(titleMetadataMap.get(id));
                        }
                        if (dateMetadataMap.containsKey(id)) {
                          wordEmbedding.setDocumentDate(dateMetadataMap.get(id));
                        }
                      }
                    }
                  } catch (Exception e) {
                    logger.warn("ignored query error", e);
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
    return new EdgeChain<>(
        Observable.create(
            emitter -> {
              try {
                List<PostgresWordEmbeddings> wordEmbeddingsList = new ArrayList<>();
                List<Map<String, Object>> rows = this.repository.getAllChunks(postgresEndpoint);
                for (Map<String, Object> row : rows) {
                  PostgresWordEmbeddings val = new PostgresWordEmbeddings();
                  val.setId(row.get("id").toString());
                  val.setRawText((String) row.get("raw_text"));
                  val.setFilename((String) row.get("filename"));
                  PGobject pgObject = (PGobject) row.get("embedding");
                  String jsonString = pgObject.getValue();
                  List<Float> values = objectMapper.readerFor(FLOAT_TYPE_REF).readValue(jsonString);
                  val.setValues(values);
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

  public EdgeChain<List<PostgresWordEmbeddings>> getSimilarMetadataChunk(
      PostgresEndpoint postgresEndpoint) {

    return new EdgeChain<>(
        Observable.create(
            emitter -> {
              try {
                List<PostgresWordEmbeddings> wordEmbeddingsList = new ArrayList<>();
                List<Map<String, Object>> rows =
                    this.metadataRepository.getSimilarMetadataChunk(
                        postgresEndpoint.getMetadataTableNames().get(0),
                        postgresEndpoint.getEmbeddingChunk());
                for (Map<String, Object> row : rows) {

                  PostgresWordEmbeddings val = new PostgresWordEmbeddings();
                  val.setMetadataId(row.get("metadata_id").toString());
                  val.setMetadata((String) row.get("metadata"));

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

  public EdgeChain<StringResponse> deleteAll(PostgresEndpoint postgresEndpoint) {

    return new EdgeChain<>(
        Observable.create(
            emitter -> {
              String namespace = getNamespace(postgresEndpoint);
              try {
                this.repository.deleteAll(postgresEndpoint.getTableName(), namespace);
                emitter.onNext(
                    new StringResponse(
                        "Word embeddings are successfully deleted for namespace:" + namespace));
                emitter.onComplete();
              } catch (final Exception e) {
                emitter.onError(e);
              }
            }),
        postgresEndpoint);
  }

  private String getNamespace(PostgresEndpoint postgresEndpoint) {
    return (Objects.isNull(postgresEndpoint.getNamespace())
            || postgresEndpoint.getNamespace().isEmpty())
        ? "knowledge"
        : postgresEndpoint.getNamespace();
  }
}
