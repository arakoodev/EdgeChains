package com.edgechain.lib.index.repositories;

import com.edgechain.lib.embeddings.WordEmbeddings;
import com.edgechain.lib.endpoint.impl.PostgresEndpoint;
import com.edgechain.lib.index.enums.PostgresDistanceMetric;
import com.edgechain.lib.utils.FloatUtils;
import com.github.f4b6a3.uuid.UuidCreator;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;

@Repository
public class PostgresClientRepository {

  @Autowired private JdbcTemplate jdbcTemplate;

  @Transactional
  public void createTable(PostgresEndpoint postgresEndpoint) {

    jdbcTemplate.execute("CREATE EXTENSION IF NOT EXISTS vector;");

    String checkTableQuery =
        String.format(
            "SELECT COUNT(*) FROM information_schema.tables WHERE table_name = '%s'",
            postgresEndpoint.getTableName());

    int tableExists = jdbcTemplate.queryForObject(checkTableQuery, Integer.class);

    String indexName;
    String vectorOps;

    if (PostgresDistanceMetric.L2.equals(postgresEndpoint.getMetric())) {
      indexName = postgresEndpoint.getTableName().concat("_").concat("l2_idx");
      vectorOps = "vector_l2_ops";
    } else if (PostgresDistanceMetric.COSINE.equals(postgresEndpoint.getMetric())) {
      indexName = postgresEndpoint.getTableName().concat("_").concat("cosine_idx");
      vectorOps = "vector_cosine_ops";
    } else {
      indexName = postgresEndpoint.getTableName().concat("_").concat("ip_idx");
      vectorOps = "vector_ip_ops";
    }

    String indexQuery =
        String.format(
            "CREATE INDEX IF NOT EXISTS %s ON %s USING ivfflat (embedding %s) WITH"
                + " (lists = %s);",
            indexName, postgresEndpoint.getTableName(), vectorOps, postgresEndpoint.getLists());

    if (tableExists == 0) {

      jdbcTemplate.execute(
          String.format(
              "CREATE TABLE IF NOT EXISTS %s (id UUID PRIMARY KEY, "
                  + " raw_text TEXT NOT NULL UNIQUE, embedding vector(%s), timestamp"
                  + " TIMESTAMP NOT NULL, namespace TEXT, filename VARCHAR(255) );",
              postgresEndpoint.getTableName(), postgresEndpoint.getDimensions()));

      jdbcTemplate.execute(indexQuery);

    } else {

      String checkIndexQuery =
          String.format(
              "SELECT COUNT(*) FROM pg_indexes WHERE tablename = '%s' AND indexname = '%s';",
              postgresEndpoint.getTableName(), indexName);

      int indexExists = jdbcTemplate.queryForObject(checkIndexQuery, Integer.class);

      if (indexExists != 1)
        throw new RuntimeException(
            "No index is specifed therefore use the following SQL:\n" + indexQuery);
    }
  }

  @Transactional
  public List<String> batchUpsertEmbeddings(
      String tableName,
      List<WordEmbeddings> wordEmbeddingsList,
      String filename,
      String namespace) {

    Set<String> uuidSet = new HashSet<>();

    for (int i = 0; i < wordEmbeddingsList.size(); i++) {
      WordEmbeddings wordEmbeddings = wordEmbeddingsList.get(i);

      if (wordEmbeddings != null && wordEmbeddings.getValues() != null) {

        float[] floatArray = FloatUtils.toFloatArray(wordEmbeddings.getValues());

        UUID id =
            jdbcTemplate.queryForObject(
                String.format(
                    "INSERT INTO %s (id, raw_text, embedding, timestamp, namespace, filename)"
                        + " VALUES ('%s', '%s', '%s', '%s', '%s', '%s')  ON CONFLICT (raw_text) DO"
                        + " UPDATE SET embedding = EXCLUDED.embedding RETURNING id;",
                    tableName,
                    UuidCreator.getTimeOrderedEpoch(),
                    wordEmbeddings.getId(),
                    Arrays.toString(floatArray),
                    LocalDateTime.now(),
                    namespace,
                    filename),
                UUID.class);

        if (id != null) {
          uuidSet.add(id.toString());
        }
      }
    }

    return new ArrayList<>(uuidSet);
  }

  @Transactional
  public String upsertEmbeddings(
      String tableName, WordEmbeddings wordEmbeddings, String filename, String namespace) {

    UUID uuid = UuidCreator.getTimeOrderedEpoch();

    jdbcTemplate.update(
        String.format(
            "INSERT INTO %s (id, raw_text, embedding, timestamp, namespace, filename) VALUES ('%s',"
                + " '%s', '%s', '%s', '%s', '%s')  ON CONFLICT (raw_text) DO UPDATE SET embedding ="
                + " EXCLUDED.embedding;",
            tableName,
            uuid,
            wordEmbeddings.getId(),
            Arrays.toString(FloatUtils.toFloatArray(wordEmbeddings.getValues())),
            LocalDateTime.now(),
            namespace,
            filename));

    return uuid.toString();
  }

  @Transactional(readOnly = true, propagation = Propagation.REQUIRED)
  public List<Map<String, Object>> query(
      String tableName,
      String namespace,
      int probes,
      PostgresDistanceMetric metric,
      List<Float> values,
      int topK) {

    String embeddings = Arrays.toString(FloatUtils.toFloatArray(values));

    jdbcTemplate.execute(String.format("SET LOCAL ivfflat.probes = %s;", probes));
    if (metric.equals(PostgresDistanceMetric.IP)) {

      return jdbcTemplate.queryForList(
          String.format(
              "SELECT id, raw_text, namespace, filename, timestamp, ( embedding <#>"
                  + " '%s') * -1 AS score FROM %s WHERE namespace='%s' ORDER BY embedding %s '%s'"
                  + " LIMIT %s;",
              embeddings,
              tableName,
              namespace,
              PostgresDistanceMetric.getDistanceMetric(metric),
              embeddings,
              topK));

    } else if (metric.equals(PostgresDistanceMetric.COSINE)) {

      return jdbcTemplate.queryForList(
          String.format(
              "SELECT id, raw_text, namespace, filename, timestamp, 1 - ( embedding"
                  + " <=> '%s') AS score FROM %s WHERE namespace='%s' ORDER BY embedding %s '%s'"
                  + " LIMIT %s;",
              embeddings,
              tableName,
              namespace,
              PostgresDistanceMetric.getDistanceMetric(metric),
              embeddings,
              topK));
    } else {
      return jdbcTemplate.queryForList(
          String.format(
              "SELECT id, raw_text, namespace, filename, timestamp, (embedding <->"
                  + " '%s') AS score FROM %s WHERE namespace='%s' ORDER BY embedding %s '%s' ASC"
                  + " LIMIT %s;",
              embeddings,
              tableName,
              namespace,
              PostgresDistanceMetric.getDistanceMetric(metric),
              embeddings,
              topK));
    }
  }

  @Transactional(readOnly = true)
  public List<Map<String, Object>> getAllChunks(PostgresEndpoint endpoint) {
    return jdbcTemplate.queryForList(
        String.format(
            "SELECT id, raw_text, embedding, filename from %s WHERE filename = '%s';",
            endpoint.getTableName(), endpoint.getFilename()));
  }

  @Transactional
  public void deleteAll(String tableName, String namespace) {
    jdbcTemplate.execute(
        String.format("delete from %s where namespace='%s'", tableName, namespace));
  }
}
