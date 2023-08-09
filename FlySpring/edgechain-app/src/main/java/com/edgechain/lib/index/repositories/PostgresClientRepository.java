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
            "CREATE TABLE IF NOT EXISTS %s (embedding_id SERIAL PRIMARY KEY, id VARCHAR(255) NOT"
                + " NULL UNIQUE, raw_text TEXT NOT NULL UNIQUE, embedding vector(%s), timestamp"
                + " TIMESTAMP NOT NULL, namespace TEXT, filename VARCHAR(255));",
            postgresEndpoint.getTableName(), postgresEndpoint.getDimensions()));
  }

  @Transactional
  public void upsertEmbeddings(
      String tableName,
      String input,
      String filename,
      WordEmbeddings wordEmbeddings,
      String namespace) {

    jdbcTemplate.execute(
        String.format(
            "INSERT INTO %s (id, raw_text, embedding, timestamp, namespace, filename) VALUES ('%s',"
                + " '%s', '%s', '%s', '%s', '%s')  ON CONFLICT (raw_text) DO UPDATE SET embedding ="
                + " EXCLUDED.embedding;",
            tableName,
            UuidCreator.getTimeOrderedEpoch().toString(),
            input,
            Arrays.toString(FloatUtils.toFloatArray(wordEmbeddings.getValues())),
            LocalDateTime.now(),
            namespace,
            filename));
  }

  @Transactional(readOnly = true)
  public List<Map<String, Object>> query(
      String tableName,
      String namespace,
      PostgresDistanceMetric metric,
      WordEmbeddings wordEmbeddings,
      int topK) {

    String embeddings = Arrays.toString(FloatUtils.toFloatArray(wordEmbeddings.getValues()));

    if (metric.equals(PostgresDistanceMetric.IP)) {

      return jdbcTemplate.queryForList(
          String.format(
              "SELECT id, raw_text, namespace, filename, timestamp, (embedding <#> '%s') * -1 AS"
                  + " score FROM %s WHERE namespace='%s' ORDER BY score DESC LIMIT %s;",
              embeddings, tableName, namespace, topK));

    } else if (metric.equals(PostgresDistanceMetric.COSINE)) {

      return jdbcTemplate.queryForList(
          String.format(
              "SELECT id, raw_text, namespace, filename, timestamp, 1 - ( embedding <=> '%s') AS"
                  + " score FROM %s WHERE namespace='%s' ORDER BY score DESC LIMIT %s;",
              embeddings, tableName, namespace, topK));
    } else {
      return jdbcTemplate.queryForList(
          String.format(
              "SELECT id, raw_text, namespace, filename, timestamp, (embedding <-> '%s') AS score"
                  + " FROM %s WHERE namespace='%s' ORDER BY score ASC LIMIT %s;",
              embeddings, tableName, namespace, topK));
    }
  }

  @Transactional
  public void deleteAll(String tableName, String namespace) {
    jdbcTemplate.execute(
        String.format("delete from %s where namespace='%s'", tableName, namespace));
  }
}
