package com.edgechain.lib.index.repositories;

import com.edgechain.lib.embeddings.WordEmbeddings;
import com.edgechain.lib.endpoint.impl.PostgresEndpoint;
import com.edgechain.lib.index.enums.PostgresDistanceMetric;
import com.edgechain.lib.utils.FloatUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.Arrays;
import java.util.List;
import java.util.Map;


@Repository
public class PostgresClientMetadataRepository {

  @Autowired private JdbcTemplate jdbcTemplate;

  @Transactional
  public void createTable(PostgresEndpoint postgresEndpoint) {
    jdbcTemplate.execute(
            String.format(
                    "CREATE TABLE IF NOT EXISTS %s (metadata_id SERIAL PRIMARY KEY, metadata TEXT, "
                    + "metadata_embedding vector(%s));",
                    postgresEndpoint.getMetadataTableNames().get(0),
                    postgresEndpoint.getDimensions()
            )
    );

    //Create a JOIN table
    jdbcTemplate.execute(
            String.format(
                    "CREATE TABLE IF NOT EXISTS %s (embedding_id INT, metadata_id INT, "
                    + "FOREIGN KEY (embedding_id) REFERENCES %s(embedding_id), "
                    + "FOREIGN KEY (metadata_id) REFERENCES %s(metadata_id), "
                    + "PRIMARY KEY (embedding_id, metadata_id));",
                    postgresEndpoint.getTableName() + "_join_" + postgresEndpoint.getMetadataTableNames().get(0),
                    postgresEndpoint.getTableName(),
                    postgresEndpoint.getMetadataTableNames().get(0)
            )
    );
  }

  @Transactional
  public Integer insertMetadata(
      String metadataTableName,
      String metadata,
      WordEmbeddings wordEmbeddings) {
    return jdbcTemplate.queryForObject(
            String.format(
                    "INSERT INTO %s (metadata, metadata_embedding) VALUES ('%s', '%s') RETURNING "
                            + "metadata_id;",
                    metadataTableName,
                    metadata,
                    Arrays.toString(FloatUtils.toFloatArray(wordEmbeddings.getValues()))
            ), Integer.class);
  }

  @Transactional
  public void insertIntoJoinTable(PostgresEndpoint postgresEndpoint) {
    String joinTableName = postgresEndpoint.getTableName() + "_join_" + postgresEndpoint.getMetadataTableNames().get(0);
    jdbcTemplate.execute(
            String.format(
                    "INSERT INTO %s (embedding_id, metadata_id) VALUES (%s, %s);",
                    joinTableName,
                    postgresEndpoint.getEmbeddingId(),
                    postgresEndpoint.getMetadataId()
            )
    );
  }

  @Transactional(readOnly = true, propagation = Propagation.REQUIRED)
  public List<Map<String, Object>> queryWithMetadata(
          String tableName,
          String metadataTableName,
          String namespace,
          int probes,
          PostgresDistanceMetric metric,
          WordEmbeddings wordEmbeddings,
          int topK) {

    String embeddings = Arrays.toString(FloatUtils.toFloatArray(wordEmbeddings.getValues()));

    jdbcTemplate.execute(String.format("SET LOCAL ivfflat.probes = %s;", probes));
    String joinTable = tableName + "_join_" + metadataTableName;

    if (metric.equals(PostgresDistanceMetric.IP)) {
      return jdbcTemplate.queryForList(
              String.format(
                      "SELECT id, metadata, j.metadata_id, raw_text, namespace, filename, timestamp, ( embedding <#> '%s') * -1 AS"
                              + " score FROM %s e INNER JOIN %s j ON e.embedding_id = j.embedding_id INNER JOIN %s m ON "
                              + "j.metadata_id = m.metadata_id WHERE namespace='%s' ORDER BY embedding %s '%s' LIMIT %s;",
                      embeddings,
                      tableName,
                      joinTable,
                      metadataTableName,
                      namespace,
                      PostgresDistanceMetric.getDistanceMetric(metric),
                      Arrays.toString(FloatUtils.toFloatArray(wordEmbeddings.getValues())),
                      topK));

    } else if (metric.equals(PostgresDistanceMetric.COSINE)) {
      return jdbcTemplate.queryForList(
              String.format(
                      "SELECT id, metadata, j.metadata_id, raw_text, namespace, filename, timestamp, 1 - ( embedding <=> '%s') "
                              + "AS score FROM %s e INNER JOIN %s j ON e.embedding_id = j.embedding_id INNER JOIN %s m ON "
                              + "j.metadata_id = m.metadata_id WHERE namespace='%s' ORDER BY embedding %s '%s' LIMIT %s;",
                      embeddings,
                      tableName,
                      joinTable,
                      metadataTableName,
                      namespace,
                      PostgresDistanceMetric.getDistanceMetric(metric),
                      Arrays.toString(FloatUtils.toFloatArray(wordEmbeddings.getValues())),
                      topK));
    } else {
      return jdbcTemplate.queryForList(
              String.format(
                      "SELECT id, metadata, j.metadata_id, raw_text, namespace, filename, timestamp, (embedding <-> '%s') "
                      + "AS score FROM %s e INNER JOIN %s j ON e.embedding_id = j.embedding_id INNER JOIN %s m ON "
                      + "j.metadata_id = m.metadata_id WHERE namespace='%s' ORDER BY embedding %s '%s' ASC LIMIT %s;",
                      embeddings,
                      tableName,
                      joinTable,
                      metadataTableName,
                      namespace,
                      PostgresDistanceMetric.getDistanceMetric(metric),
                      Arrays.toString(FloatUtils.toFloatArray(wordEmbeddings.getValues())),
                      topK));
    }
  }

  @Transactional(readOnly = true, propagation = Propagation.REQUIRED)
  public List<Map<String, Object>> similaritySearchMetadata(
          String metadataTableName,
          PostgresDistanceMetric metric,
          WordEmbeddings wordEmbeddings,
          int topK) {

    String embeddings = Arrays.toString(FloatUtils.toFloatArray(wordEmbeddings.getValues()));

    if (metric.equals(PostgresDistanceMetric.IP)) {
      return jdbcTemplate.queryForList(
              String.format(
                      "SELECT metadata_id, metadata, ( metadata_embedding <#> '%s') * -1 AS score FROM %s ORDER BY "
                      + "metadata_embedding %s '%s' LIMIT %s;",
                      embeddings,
                      metadataTableName,
                      PostgresDistanceMetric.getDistanceMetric(metric),
                      Arrays.toString(FloatUtils.toFloatArray(wordEmbeddings.getValues())),
                      topK));

    } else if (metric.equals(PostgresDistanceMetric.COSINE)) {
      return jdbcTemplate.queryForList(
              String.format(
                      "SELECT metadata_id, metadata, 1 - ( metadata_embedding <=> '%s') AS score FROM %s ORDER BY "
                      + "metadata_embedding %s '%s' LIMIT %s;",
                      embeddings,
                      metadataTableName,
                      PostgresDistanceMetric.getDistanceMetric(metric),
                      Arrays.toString(FloatUtils.toFloatArray(wordEmbeddings.getValues())),
                      topK));
    } else {
      return jdbcTemplate.queryForList(
              String.format(
                      "SELECT metadata_id, metadata, (metadata_embedding <-> '%s') AS score FROM %s ORDER BY "
                      + "metadata_embedding %s '%s' ASC LIMIT %s;",
                      embeddings,
                      metadataTableName,
                      PostgresDistanceMetric.getDistanceMetric(metric),
                      Arrays.toString(FloatUtils.toFloatArray(wordEmbeddings.getValues())),
                      topK));
    }
  }
  }

