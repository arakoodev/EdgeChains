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
    String metadataTable = postgresEndpoint.getMetadataTableNames().get(0);
    jdbcTemplate.execute(
        String.format(
            "CREATE TABLE IF NOT EXISTS %s (metadata_id UUID PRIMARY KEY, metadata TEXT NOT NULL UNIQUE);",
                metadataTable));

    //Creating a GIN index for improving the performance
//    String index = metadataTable.concat("_search_idx");
//    jdbcTemplate.execute(
//            String.format(
//                    "CREATE INDEX %s ON %s USING GIN (to_tsvector(%s.metadata));",
//                    index,
//                    metadataTable,
//                    metadataTable
//            )
//    );

    // Create a JOIN table
    jdbcTemplate.execute(
        String.format(
            "CREATE TABLE IF NOT EXISTS %s (id UUID, metadata_id UUID, "
                + "FOREIGN KEY (id) REFERENCES %s(id), "
                + "FOREIGN KEY (metadata_id) REFERENCES %s(metadata_id), "
                + "PRIMARY KEY (id, metadata_id));",
            postgresEndpoint.getTableName()
                + "_join_"
                + metadataTable,
            postgresEndpoint.getTableName(),
                metadataTable));
  }

  public List<String> batchInsertMetadata(
          String metadataTableName, List<String> metadataList)
  {
    List<String> uuidList = new ArrayList<>();

    String[] sql = new String[metadataList.size()];

    for(int i = 0; i < metadataList.size(); i++) {
      UUID uuid = UuidCreator.getTimeOrderedEpoch();

      sql[i] =  String.format(
              "INSERT INTO %s (metadata_id, metadata) VALUES ('%s', '%s');",
              metadataTableName,
              uuid,
              metadataList.get(i));
      uuidList.add(uuid.toString());
    }
    jdbcTemplate.batchUpdate(sql);

    return uuidList;
  }
  @Transactional
  public String insertMetadata(
      String metadataTableName, String metadata) {

    UUID uuid = UuidCreator.getTimeOrderedEpoch();
    jdbcTemplate.update(
            String.format(
                    "INSERT INTO %s (metadata_id, metadata) VALUES ('%s', '%s');",
                    metadataTableName,
                    uuid,
                    metadata));
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


  //Full-text search
  @Transactional(readOnly = true, propagation = Propagation.REQUIRED)
  public List<Map<String, Object>> getSimilarMetadataChunk(
      String metadataTableName,
      String embeddingChunk) {
    return jdbcTemplate.queryForList(
            String.format(
                    "SELECT *, ts_rank(to_tsvector(%s.metadata), query) as rank_metadata " +
                            "FROM %s, to_tsvector(%s.metadata) document, to_tsquery('%s') query " +
                            "WHERE query @@ document ORDER BY rank_metadata DESC",
                    metadataTableName,
                    metadataTableName,
                    metadataTableName,
                    embeddingChunk
            )
    );
  }

}
