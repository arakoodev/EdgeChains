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
public class PostgresClientMetadataRepository {

  @Autowired private JdbcTemplate jdbcTemplate;

  @Transactional
  public void createTable(PostgresEndpoint postgresEndpoint) {
    jdbcTemplate.execute(
        String.format(
            "CREATE TABLE IF NOT EXISTS %s (metadata_id UUID PRIMARY KEY, metadata TEXT NOT NULL UNIQUE, "
                + "metadata_embedding vector(%s));",
            postgresEndpoint.getMetadataTableNames().get(0), postgresEndpoint.getDimensions()));

    // Create a JOIN table
    jdbcTemplate.execute(
        String.format(
            "CREATE TABLE IF NOT EXISTS %s (id UUID, metadata_id UUID, "
                + "FOREIGN KEY (id) REFERENCES %s(id), "
                + "FOREIGN KEY (metadata_id) REFERENCES %s(metadata_id), "
                + "PRIMARY KEY (id, metadata_id));",
            postgresEndpoint.getTableName()
                + "_join_"
                + postgresEndpoint.getMetadataTableNames().get(0),
            postgresEndpoint.getTableName(),
            postgresEndpoint.getMetadataTableNames().get(0)));
  }

  public List<String> batchInsertMetadata(
          String metadataTableName, List<WordEmbeddings> wordEmbeddingsList)
  {
    List<String> uuidList = new ArrayList<>();

    String[] sql = new String[wordEmbeddingsList.size()];

    for(int i = 0; i < wordEmbeddingsList.size(); i++) {
      UUID uuid = UuidCreator.getTimeOrderedEpoch();

      sql[i] =  String.format(
              "INSERT INTO %s (metadata_id, metadata, metadata_embedding) VALUES ('%s', '%s', '%s');",
              metadataTableName,
              uuid,
              wordEmbeddingsList.get(i).getId(),
              Arrays.toString(FloatUtils.toFloatArray(wordEmbeddingsList.get(i).getValues())));
      uuidList.add(uuid.toString());
    }


    jdbcTemplate.batchUpdate(sql);

    return uuidList;
  }
  @Transactional
  public String insertMetadata(
      String metadataTableName, String metadata, List<Float> values) {

    UUID uuid = UuidCreator.getTimeOrderedEpoch();
    jdbcTemplate.update(
            String.format(
                    "INSERT INTO %s (metadata_id, metadata, metadata_embedding) VALUES ('%s', '%s', '%s');",
                    metadataTableName,
                    uuid,
                    metadata,
                    Arrays.toString(FloatUtils.toFloatArray(values))));
    return uuid.toString();
  }

  @Transactional
  public void insertIntoJoinTable(PostgresEndpoint postgresEndpoint) {
    String joinTableName =
        postgresEndpoint.getTableName()
            + "_join_"
            + postgresEndpoint.getMetadataTableNames().get(0);
    jdbcTemplate.execute(
        String.format(
            "INSERT INTO %s (id, metadata_id) VALUES ('%s', '%s');",
            joinTableName, UUID.fromString(postgresEndpoint.getId()), UUID.fromString(postgresEndpoint.getMetadataId())));
  }

  @Transactional(readOnly = true, propagation = Propagation.REQUIRED)
  public List<Map<String, Object>> queryWithMetadata(
      String tableName,
      String metadataTableName,
      String namespace,
      int probes,
      PostgresDistanceMetric metric,
      List<Float> values,
      int topK) {

    String embeddings = Arrays.toString(FloatUtils.toFloatArray(values));

    jdbcTemplate.execute(String.format("SET LOCAL ivfflat.probes = %s;", probes));
    String joinTable = tableName + "_join_" + metadataTableName;

    if (metric.equals(PostgresDistanceMetric.IP)) {
      return jdbcTemplate.queryForList(
          String.format(
              "SELECT e.id, metadata, j.metadata_id, raw_text, namespace, filename, timestamp, ("
                  + " embedding <#> '%s') * -1 AS score FROM %s e INNER JOIN %s j ON e.id"
                  + " = j.id INNER JOIN %s m ON j.metadata_id = m.metadata_id WHERE"
                  + " namespace='%s' ORDER BY embedding %s '%s' LIMIT %s;",
              embeddings,
              tableName,
              joinTable,
              metadataTableName,
              namespace,
              PostgresDistanceMetric.getDistanceMetric(metric),
              embeddings,
              topK));

    } else if (metric.equals(PostgresDistanceMetric.COSINE)) {
      return jdbcTemplate.queryForList(
          String.format(
              "SELECT e.id, metadata, j.metadata_id, raw_text, namespace, filename, timestamp, 1 - ("
                  + " embedding <=> '%s') AS score FROM %s e INNER JOIN %s j ON e.id ="
                  + " j.id INNER JOIN %s m ON j.metadata_id = m.metadata_id WHERE"
                  + " namespace='%s' ORDER BY embedding %s '%s' LIMIT %s;",
              embeddings,
              tableName,
              joinTable,
              metadataTableName,
              namespace,
              PostgresDistanceMetric.getDistanceMetric(metric),
              embeddings,
              topK));
    } else {
      return jdbcTemplate.queryForList(
          String.format(
              "SELECT e.id, metadata, j.metadata_id, raw_text, namespace, filename, timestamp,"
                  + " (embedding <-> '%s') AS score FROM %s e INNER JOIN %s j ON e.id ="
                  + " j.id INNER JOIN %s m ON j.metadata_id = m.metadata_id WHERE"
                  + " namespace='%s' ORDER BY embedding %s '%s' ASC LIMIT %s;",
              embeddings,
              tableName,
              joinTable,
              metadataTableName,
              namespace,
              PostgresDistanceMetric.getDistanceMetric(metric),
              embeddings,
              topK));
    }
  }

  @Transactional(readOnly = true, propagation = Propagation.REQUIRED)
  public List<Map<String, Object>> similaritySearchMetadata(
      String metadataTableName,
      PostgresDistanceMetric metric,
      List<Float> values,
      int topK) {

    String embeddings = Arrays.toString(FloatUtils.toFloatArray(values));

    if (metric.equals(PostgresDistanceMetric.IP)) {
      return jdbcTemplate.queryForList(
          String.format(
              "SELECT metadata_id, metadata, ( metadata_embedding <#> '%s') * -1 AS score FROM %s"
                  + " ORDER BY metadata_embedding %s '%s' LIMIT %s;",
              embeddings,
              metadataTableName,
              PostgresDistanceMetric.getDistanceMetric(metric),
              Arrays.toString(FloatUtils.toFloatArray(values)),
              topK));

    } else if (metric.equals(PostgresDistanceMetric.COSINE)) {
      return jdbcTemplate.queryForList(
          String.format(
              "SELECT metadata_id, metadata, 1 - ( metadata_embedding <=> '%s') AS score FROM %s"
                  + " ORDER BY metadata_embedding %s '%s' LIMIT %s;",
              embeddings,
              metadataTableName,
              PostgresDistanceMetric.getDistanceMetric(metric),
              Arrays.toString(FloatUtils.toFloatArray(values)),
              topK));
    } else {
      return jdbcTemplate.queryForList(
          String.format(
              "SELECT metadata_id, metadata, (metadata_embedding <-> '%s') AS score FROM %s ORDER"
                  + " BY metadata_embedding %s '%s' ASC LIMIT %s;",
              embeddings,
              metadataTableName,
              PostgresDistanceMetric.getDistanceMetric(metric),
              Arrays.toString(FloatUtils.toFloatArray(values)),
              topK));
    }
  }
}
