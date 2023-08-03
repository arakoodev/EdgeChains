package com.edgechain.lib.index.repositories;

import com.edgechain.lib.embeddings.WordEmbeddings;
import com.edgechain.lib.endpoint.impl.PostgresEndpoint;
import com.edgechain.lib.index.enums.PostgresDistanceMetric;
import com.edgechain.lib.utils.FloatUtils;
import com.github.f4b6a3.uuid.UuidCreator;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.Map;

@Repository
public class PostgresClientRepository {

  @Autowired private JdbcTemplate jdbcTemplate;

  @Transactional
  public void createTable(PostgresEndpoint postgresEndpoint) {

    jdbcTemplate.execute("CREATE EXTENSION IF NOT EXISTS vector;");
    jdbcTemplate.execute(
        String.format(
            "CREATE TABLE IF NOT EXISTS %s (id TEXT PRIMARY KEY, raw TEXT, sno SERIAL, embedding"
                + " vector(%s), namespace TEXT, fileName TEXT, timestamp TIMESTAMP);",
            postgresEndpoint.getTableName(), postgresEndpoint.getDimensions()));
  }

  @Transactional
  public void upsertEmbeddings(
      String tableName, String input, WordEmbeddings wordEmbeddings, String namespace) {
    String id = UuidCreator.getTimeOrderedEpoch().toString();
    LocalDateTime timestamp = LocalDateTime.now();
    jdbcTemplate.execute(
        String.format(
            "INSERT INTO %s (id, raw, embedding, namespace, timestamp) VALUES ('%s', '%s', '%s', '%s', '%s')\n"
                + "    ON CONFLICT (id) DO UPDATE SET embedding = EXCLUDED.embedding;",
            tableName,
            id,
            input,
            Arrays.toString(FloatUtils.toFloatArray(wordEmbeddings.getValues())),
            namespace, timestamp.toString()));
  }

  //Use this function to insert embeddings with filename
  @Transactional
  public void upsertEmbeddingsWithFilename(
      String tableName, String input, WordEmbeddings wordEmbeddings, String namespace, String fileName) {
    String id = UuidCreator.getTimeOrderedEpoch().toString();
    LocalDateTime timestamp = LocalDateTime.now();
    jdbcTemplate.execute(
        String.format(
            "INSERT INTO %s (id, raw, embedding, namespace, fileName, timestamp) VALUES ('%s', '%s', '%s', '%s', '%s', '%s')\n"
                + "    ON CONFLICT (id) DO UPDATE SET embedding = EXCLUDED.embedding;",
            tableName,
            id,
            input,
            Arrays.toString(FloatUtils.toFloatArray(wordEmbeddings.getValues())),
            namespace, fileName, timestamp.toString()));
  }

  @Transactional(readOnly = true)
  public List<Map<String, Object>> query(
      String tableName,
      String namespace,
      PostgresDistanceMetric metric,
      WordEmbeddings wordEmbeddings,
      int topK) {

    return jdbcTemplate.queryForList(
        String.format(
            "SELECT raw FROM %s WHERE namespace='%s' ORDER BY embedding %s '%s' LIMIT %s;",
            tableName,
            namespace,
            PostgresDistanceMetric.getDistanceMetric(metric),
            Arrays.toString(FloatUtils.toFloatArray(wordEmbeddings.getValues())),
            topK));
  }

  //Use this function to query embeddings with filename
  @Transactional(readOnly = true)
  public List<Map<String, Object>> queryWithFilename(
      String tableName,
      String namespace,
      PostgresDistanceMetric metric,
      WordEmbeddings wordEmbeddings,
      int topK) {

    return jdbcTemplate.queryForList(
        String.format(
            "SELECT id, sno, raw, filename, timestamp FROM %s WHERE namespace='%s' ORDER BY embedding %s '%s' LIMIT %s;",
            tableName,
            namespace,
            PostgresDistanceMetric.getDistanceMetric(metric),
            Arrays.toString(FloatUtils.toFloatArray(wordEmbeddings.getValues())),
            topK));
  }

  @Transactional
  public void deleteAll(String tableName, String namespace) {
    jdbcTemplate.execute(
        String.format("delete from %s where namespace='%s'", tableName, namespace));
  }
}
