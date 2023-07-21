package com.edgechain.lib.index.repositories;

import com.edgechain.lib.embeddings.WordEmbeddings;
import com.edgechain.lib.endpoint.impl.PostgresEndpoint;
import com.edgechain.lib.index.enums.PostgresDistanceMetric;
import com.edgechain.lib.utils.FloatUtils;
import com.zaxxer.hikari.HikariDataSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

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
            "CREATE TABLE IF NOT EXISTS %s (id TEXT PRIMARY KEY, embedding"
                + " vector(%s), namespace TEXT);",
            postgresEndpoint.getTableName(), postgresEndpoint.getDimensions()));
  }

  @Transactional
  public void upsertEmbeddings(
      String tableName, String input, WordEmbeddings wordEmbeddings, String namespace) {

    jdbcTemplate.execute(
        String.format(
            "INSERT INTO %s (id, embedding, namespace) VALUES ('%s', '%s', '%s')\n"
                + "    ON CONFLICT (id) DO UPDATE SET embedding = EXCLUDED.embedding;",
            tableName,
            input,
            Arrays.toString(FloatUtils.toFloatArray(wordEmbeddings.getValues())),
            namespace));
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
            "SELECT id FROM %s WHERE namespace='%s' ORDER BY embedding %s '%s' LIMIT %s;",
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
