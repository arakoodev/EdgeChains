package com.edgechain.lib.index.repositories;

import com.edgechain.lib.endpoint.impl.PostgresEndpoint;
import com.edgechain.lib.index.enums.PostgresDistanceMetric;
import com.edgechain.lib.utils.FloatUtils;
import com.github.f4b6a3.uuid.UuidCreator;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Repository
public class PostgresClientMetadataRepository {

  @Autowired private JdbcTemplate jdbcTemplate;

  @Transactional
  public void createTable(PostgresEndpoint postgresEndpoint) {
    String metadataTable = postgresEndpoint.getMetadataTableNames().get(0);
    jdbcTemplate.execute(
        String.format(
            "CREATE TABLE IF NOT EXISTS %s (metadata_id UUID PRIMARY KEY, metadata TEXT NOT NULL,"
                + " document_date DATE);",
            postgresEndpoint.getTableName() + "_" + metadataTable));

    // Create a JOIN table
    jdbcTemplate.execute(
        String.format(
            "CREATE TABLE IF NOT EXISTS %s (id UUID UNIQUE NOT NULL, metadata_id UUID NOT NULL, "
                + "FOREIGN KEY (id) REFERENCES %s(id) ON DELETE CASCADE, "
                + "FOREIGN KEY (metadata_id) REFERENCES %s(metadata_id) ON DELETE CASCADE, "
                + "PRIMARY KEY (id, metadata_id));",
            postgresEndpoint.getTableName() + "_join_" + metadataTable,
            postgresEndpoint.getTableName(),
            postgresEndpoint.getTableName() + "_" + metadataTable));

    jdbcTemplate.execute(
        String.format(
            "CREATE INDEX IF NOT EXISTS idx_%s ON %s (metadata_id);",
            postgresEndpoint.getTableName() + "_join_" + metadataTable,
            postgresEndpoint.getTableName() + "_join_" + metadataTable));
  }

  @Transactional
  public List<String> batchInsertMetadata(
      String table, String metadataTableName, List<String> metadataList) {

    Set<String> uuidSet = new HashSet<>();

    for (int i = 0; i < metadataList.size(); i++) {

      String metadata = metadataList.get(i).replace("'", "");

      UUID metadataId =
          jdbcTemplate.queryForObject(
              String.format(
                  "INSERT INTO %s (metadata_id, metadata) VALUES ('%s', ?) RETURNING metadata_id;",
                  table.concat("_").concat(metadataTableName), UuidCreator.getTimeOrderedEpoch()),
              UUID.class,
              metadata);

      if (metadataId != null) {
        uuidSet.add(metadataId.toString());
      }
    }

    return new ArrayList<>(uuidSet);
  }

  @Transactional
  public String insertMetadata(
      String table, String metadataTableName, String metadata, String documentDate) {

    metadata = metadata.replace("'", "");

    UUID metadataId =
        jdbcTemplate.queryForObject(
            String.format(
                "INSERT INTO %s (metadata_id, metadata, document_date) VALUES ('%s', ?,"
                    + " TO_DATE(NULLIF(?, ''), 'Month DD, YYYY')) RETURNING metadata_id;",
                table.concat("_").concat(metadataTableName), UuidCreator.getTimeOrderedEpoch()),
            UUID.class,
            metadata,
            documentDate);

    return Objects.requireNonNull(metadataId).toString();
  }

  @Transactional
  public void insertIntoJoinTable(PostgresEndpoint postgresEndpoint) {
    String joinTableName =
        postgresEndpoint.getTableName()
            + "_join_"
            + postgresEndpoint.getMetadataTableNames().get(0);
    jdbcTemplate.execute(
        String.format(
            "INSERT INTO %s (id, metadata_id) VALUES ('%s', '%s') ON CONFLICT (id) DO UPDATE SET"
                + " metadata_id = EXCLUDED.metadata_id;",
            joinTableName,
            UUID.fromString(postgresEndpoint.getId()),
            UUID.fromString(postgresEndpoint.getMetadataId())));
  }

  @Transactional
  public void batchInsertIntoJoinTable(
      String tableName, String metadataTableName, List<String> idList, String metadataId) {
    String joinTableName = tableName + "_join_" + metadataTableName;
    List<String> sqlStatements = new ArrayList<>();
    for (String id : idList) {
      sqlStatements.add(
          String.format(
              "INSERT INTO %s (id, metadata_id) VALUES ('%s', '%s') ON CONFLICT (id) DO UPDATE SET"
                  + " metadata_id = EXCLUDED.metadata_id;",
              joinTableName, UUID.fromString(id), UUID.fromString(metadataId)));
    }
    jdbcTemplate.batchUpdate(sqlStatements.toArray(new String[0]));
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
              "SELECT e.id, metadata, TO_CHAR(document_date, 'Month DD, YYYY') as document_date,"
                  + " j.metadata_id, raw_text, namespace, filename, timestamp, ( embedding <#>"
                  + " '%s') * -1 AS score FROM %s e INNER JOIN %s j ON e.id = j.id INNER JOIN %s m"
                  + " ON j.metadata_id = m.metadata_id WHERE namespace='%s' ORDER BY embedding %s"
                  + " '%s' LIMIT %s;",
              embeddings,
              tableName,
              joinTable,
              tableName.concat("_").concat(metadataTableName),
              namespace,
              PostgresDistanceMetric.getDistanceMetric(metric),
              embeddings,
              topK));

    } else if (metric.equals(PostgresDistanceMetric.COSINE)) {
      return jdbcTemplate.queryForList(
          String.format(
              "SELECT e.id, metadata, TO_CHAR(document_date, 'Month DD, YYYY') as document_date,"
                  + " j.metadata_id, raw_text, namespace, filename, timestamp, 1 - ( embedding <=>"
                  + " '%s') AS score FROM %s e INNER JOIN %s j ON e.id = j.id INNER JOIN %s m ON"
                  + " j.metadata_id = m.metadata_id WHERE namespace='%s' ORDER BY embedding %s '%s'"
                  + " LIMIT %s;",
              embeddings,
              tableName,
              joinTable,
              tableName.concat("_").concat(metadataTableName),
              namespace,
              PostgresDistanceMetric.getDistanceMetric(metric),
              embeddings,
              topK));
    } else {
      return jdbcTemplate.queryForList(
          String.format(
              "SELECT e.id, metadata, TO_CHAR(document_date, 'Month DD, YYYY') as document_date,"
                  + " j.metadata_id, raw_text, namespace, filename, timestamp, (embedding <-> '%s')"
                  + " AS score FROM %s e INNER JOIN %s j ON e.id = j.id INNER JOIN %s m ON"
                  + " j.metadata_id = m.metadata_id WHERE namespace='%s' ORDER BY embedding %s '%s'"
                  + " ASC LIMIT %s;",
              embeddings,
              tableName,
              joinTable,
              tableName.concat("_").concat(metadataTableName),
              namespace,
              PostgresDistanceMetric.getDistanceMetric(metric),
              embeddings,
              topK));
    }
  }

  // Full-text search
  @Transactional(readOnly = true, propagation = Propagation.REQUIRED)
  public List<Map<String, Object>> getSimilarMetadataChunk(
      String table, String metadataTableName, String embeddingChunk) {
    // Remove special characters and replace with a space
    String cleanEmbeddingChunk =
        embeddingChunk.replaceAll("[^a-zA-Z0-9\\s]", " ").replaceAll("\\s+", " ").trim();

    String tableName = table.concat("_").concat(metadataTableName);

    // Split the embeddingChunk into words and join them with the '|' (OR) operator
    String tsquery = String.join(" | ", cleanEmbeddingChunk.split("\\s+"));
    return jdbcTemplate.queryForList(
        String.format(
            "SELECT *, ts_rank(to_tsvector(%s.metadata), query) as rank_metadata "
                + "FROM %s, to_tsvector(%s.metadata) document, to_tsquery('%s') query "
                + "WHERE query @@ document ORDER BY rank_metadata DESC",
            tableName, tableName, tableName, tsquery));
  }
}
