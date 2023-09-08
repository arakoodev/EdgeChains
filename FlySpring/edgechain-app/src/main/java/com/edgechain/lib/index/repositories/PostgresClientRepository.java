package com.edgechain.lib.index.repositories;

import com.edgechain.lib.embeddings.WordEmbeddings;
import com.edgechain.lib.endpoint.impl.PostgresEndpoint;
import com.edgechain.lib.index.enums.PostgresDistanceMetric;
import com.edgechain.lib.index.enums.PostgresLanguage;
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
    jdbcTemplate.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm;");

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

    String tsvIndexQuery =
        String.format(
            "CREATE INDEX IF NOT EXISTS %s ON %s USING GIN(tsv);",
            postgresEndpoint.getTableName().concat("_tsv_idx"), postgresEndpoint.getTableName());

    if (tableExists == 0) {

      jdbcTemplate.execute(
          String.format(
              "CREATE TABLE IF NOT EXISTS %s (id UUID PRIMARY KEY, "
                  + " raw_text TEXT NOT NULL UNIQUE, embedding vector(%s), timestamp"
                  + " TIMESTAMP NOT NULL, namespace TEXT, filename VARCHAR(255), tsv TSVECTOR);",
              postgresEndpoint.getTableName(), postgresEndpoint.getDimensions()));

      jdbcTemplate.execute(indexQuery);
      jdbcTemplate.execute(tsvIndexQuery);

    } else {

      String checkIndexQuery =
          String.format(
              "SELECT COUNT(*) FROM pg_indexes WHERE tablename = '%s' AND indexname = '%s';",
              postgresEndpoint.getTableName(), indexName);

      Integer indexExists = jdbcTemplate.queryForObject(checkIndexQuery, Integer.class);

      if (indexExists != null && indexExists != 1)
        throw new RuntimeException(
            "No index is specified therefore use the following SQL:\n" + indexQuery);
    }
  }

  @Transactional
  public List<String> batchUpsertEmbeddings(
      String tableName,
      List<WordEmbeddings> wordEmbeddingsList,
      String filename,
      String namespace,
      PostgresLanguage language) {

    Set<String> uuidSet = new HashSet<>();

    for (int i = 0; i < wordEmbeddingsList.size(); i++) {
      WordEmbeddings wordEmbeddings = wordEmbeddingsList.get(i);

      if (wordEmbeddings != null && wordEmbeddings.getValues() != null) {

        float[] floatArray = FloatUtils.toFloatArray(wordEmbeddings.getValues());
        String rawText = wordEmbeddings.getId();

        UUID id =
            jdbcTemplate.queryForObject(
                String.format(
                    "INSERT INTO %s (id, raw_text, embedding, timestamp, namespace, filename, tsv)"
                        + " VALUES ('%s', ?, '%s', '%s', '%s', '%s', TO_TSVECTOR('%s', '%s'))  ON CONFLICT (raw_text) DO"
                        + " UPDATE SET embedding = EXCLUDED.embedding RETURNING id;",
                    tableName,
                    UuidCreator.getTimeOrderedEpoch(),
                    Arrays.toString(floatArray),
                    LocalDateTime.now(),
                    namespace,
                    filename,
                    language.getValue(),
                    rawText),
                UUID.class,
                rawText);

        if (id != null) {
          uuidSet.add(id.toString());
        }
      }
    }

    return new ArrayList<>(uuidSet);
  }

  @Transactional
  public String upsertEmbeddings(
      String tableName,
      WordEmbeddings wordEmbeddings,
      String filename,
      String namespace,
      PostgresLanguage language) {

    float[] floatArray = FloatUtils.toFloatArray(wordEmbeddings.getValues());
    String rawText = wordEmbeddings.getId();

    UUID uuid =
        jdbcTemplate.queryForObject(
            String.format(
                "INSERT INTO %s (id, raw_text, embedding, timestamp, namespace, filename, tsv)"
                    + " VALUES ('%s', ?, '%s', '%s', '%s', '%s', TO_TSVECTOR('%s', '%s'))  ON CONFLICT (raw_text) DO"
                    + " UPDATE SET embedding = EXCLUDED.embedding RETURNING id;",
                tableName,
                UuidCreator.getTimeOrderedEpoch(),
                Arrays.toString(floatArray),
                LocalDateTime.now(),
                namespace,
                filename,
                language.getValue(),
                rawText),
            UUID.class,
            rawText);

    return Objects.requireNonNull(uuid).toString();
  }

  @Transactional(readOnly = true, propagation = Propagation.REQUIRED)
  public List<Map<String, Object>> query(
      String tableName,
      String namespace,
      int probes,
      PostgresDistanceMetric metric,
      List<List<Float>> values,
      int topK) {

    jdbcTemplate.execute(String.format("SET LOCAL ivfflat.probes = %s;", probes));

    StringBuilder query = new StringBuilder();

    for (int i = 0; i < values.size(); i++) {

      String embeddings = Arrays.toString(FloatUtils.toFloatArray(values.get(i)));

      query.append("(").append("SELECT id, raw_text, embedding, namespace, filename, timestamp,");

      switch (metric) {
        case COSINE -> query
            .append(String.format("1 - (embedding <=> '%s') AS score ", embeddings))
            .append(" FROM ")
            .append(tableName)
            .append(" WHERE namespace = ")
            .append("'")
            .append(namespace)
            .append("'")
            .append(" ORDER BY embedding <=> ")
            .append("'")
            .append(embeddings)
            .append("'")
            .append(" LIMIT ");
        case IP -> query
            .append(String.format("(embedding <#> '%s') * -1 AS score ", embeddings))
            .append(" FROM ")
            .append(tableName)
            .append(" WHERE namespace = ")
            .append("'")
            .append(namespace)
            .append("'")
            .append(" ORDER BY embedding <#> ")
            .append("'")
            .append(embeddings)
            .append("'")
            .append(" LIMIT ");
        case L2 -> query
            .append(String.format("embedding <-> '%s' AS score ", embeddings))
            .append(" FROM ")
            .append(tableName)
            .append(" WHERE namespace = ")
            .append("'")
            .append(namespace)
            .append("'")
            .append(" ORDER BY embedding <-> ")
            .append("'")
            .append(embeddings)
            .append("'")
            .append(" LIMIT ");
        default -> throw new IllegalArgumentException("Invalid similarity measure: " + metric);
      }

      if (values.size() == 1) query.append(topK);
      else query.append(1);

      query.append(")");

      if (i < values.size() - 1) {
        query.append(" UNION ALL  ").append("\n");
      }
    }

    if (values.size() > 1) {
      return jdbcTemplate.queryForList(
          String.format("SELECT DISTINCT ON (result.id) *\n" + "FROM ( %s ) result;", query));
    } else {
      return jdbcTemplate.queryForList(query.toString());
    }
  }

  public List<Map<String, Object>> queryRRF(
      String tableName,
      String namespace,
      String metadataTableName,
      List<Float> values,
      double textRankWeight,
      double similarityWeight,
      double dateRankWeight,
      String searchQuery,
      PostgresLanguage language,
      PostgresDistanceMetric metric,
      int topK) {

    if (textRankWeight < 0
        || textRankWeight > 1.0
        || similarityWeight < 0
        || similarityWeight > 1.0
        || dateRankWeight < 0
        || dateRankWeight > 1.0) {
      throw new IllegalArgumentException("Weights must be between 0 and 1.");
    }

    String embeddings = Arrays.toString(FloatUtils.toFloatArray(values));

    StringBuilder query = new StringBuilder();
    query
        .append("SELECT id, raw_text, document_date, metadata,")
        .append(
            String.format(
                "1 / (ROW_NUMBER() OVER (ORDER BY text_rank DESC) + %s) +", textRankWeight))
        .append(
            String.format(
                "1 / (ROW_NUMBER() OVER (ORDER BY similarity DESC) + %s) +", similarityWeight))
        .append(
            String.format(
                "1 / (ROW_NUMBER() OVER (ORDER BY date_rank DESC) + %s) AS rrf_score ",
                dateRankWeight))
        .append("FROM ( ")
        .append("SELECT sv.id, sv.raw_text, svtm.document_date, svtm.metadata, ")
        .append(
            String.format(
                "ts_rank_cd(sv.tsv, plainto_tsquery('%s', '%s')) AS text_rank, ",
                language.getValue(), searchQuery));

    switch (metric) {
      case COSINE -> query.append(
          String.format("1 - (sv.embedding <=> '%s') AS similarity, ", embeddings));
      case IP -> query.append(
          String.format("(sv.embedding <#> '%s') * -1 AS similarity, ", embeddings));
      case L2 -> query.append(String.format("sv.embedding <-> '%s' AS similarity, ", embeddings));
      default -> throw new IllegalArgumentException("Invalid similarity measure: " + metric);
    }

    query
        .append("CASE ")
        .append("WHEN svtm.document_date IS NULL THEN 0 ") // Null date handling
        .append(
            "ELSE EXTRACT(YEAR FROM svtm.document_date) * 365 + EXTRACT(DOY FROM svtm.document_date) ")
        .append("END AS date_rank ")
        .append("FROM ")
        .append(tableName)
        .append(" sv ")
        .append("JOIN ")
        .append(tableName.concat("_join_").concat(metadataTableName))
        .append(" jtm ON sv.id = jtm.id ")
        .append("JOIN ")
        .append(tableName.concat("_").concat(metadataTableName))
        .append(" svtm ON jtm.metadata_id = svtm.metadata_id ")
        .append("WHERE namespace = ")
        .append("'")
        .append(namespace)
        .append("'")
        .append(") subquery ")
        .append("ORDER BY rrf_score DESC")
        .append(" LIMIT ")
        .append(topK)
        .append(";");

    return jdbcTemplate.queryForList(query.toString());
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
