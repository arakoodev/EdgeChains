package com.edgechain.lib.index.repositories;

import com.edgechain.lib.embeddings.WordEmbeddings;
import com.edgechain.lib.endpoint.impl.index.PostgresEndpoint;
import com.edgechain.lib.index.domain.RRFWeight;
import com.edgechain.lib.index.enums.OrderRRFBy;
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
        String rawText = wordEmbeddings.getId().replace("'", "");

        UUID id =
            jdbcTemplate.queryForObject(
                String.format(
                    "INSERT INTO %s (id, raw_text, embedding, timestamp, namespace, filename, tsv)"
                        + " VALUES ('%s', ?, '%s', '%s', '%s', '%s', TO_TSVECTOR('%s', '%s'))  ON"
                        + " CONFLICT (raw_text) DO UPDATE SET embedding = EXCLUDED.embedding"
                        + " RETURNING id;",
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
    String rawText = wordEmbeddings.getId().replace("'", "");

    UUID uuid =
        jdbcTemplate.queryForObject(
            String.format(
                "INSERT INTO %s (id, raw_text, embedding, timestamp, namespace, filename, tsv)"
                    + " VALUES ('%s', ?, '%s', '%s', '%s', '%s', TO_TSVECTOR('%s', '%s'))  ON"
                    + " CONFLICT (raw_text) DO UPDATE SET embedding = EXCLUDED.embedding RETURNING"
                    + " id;",
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
      int topK,
      int upperLimit) {

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
      query.append(topK).append(")");

      if (i < values.size() - 1) {
        query.append(" UNION ALL  ").append("\n");
      }
    }

    if (values.size() > 1) {
      return jdbcTemplate.queryForList(
          String.format(
              "SELECT * FROM (SELECT DISTINCT ON (result.id) * FROM ( %s ) result) subquery  ORDER"
                  + " BY score DESC LIMIT %s;",
              query, upperLimit));
    } else {
      return jdbcTemplate.queryForList(query.toString());
    }
  }

  public List<Map<String, Object>> queryRRF(
      String tableName,
      String namespace,
      String metadataTableName,
      List<List<Float>> values,
      RRFWeight textWeight,
      RRFWeight similarityWeight,
      RRFWeight dateWeight,
      String searchQuery,
      PostgresLanguage language,
      int probes,
      PostgresDistanceMetric metric,
      int topK,
      int upperLimit,
      OrderRRFBy orderRRFBy) {

    jdbcTemplate.execute(String.format("SET LOCAL ivfflat.probes = %s;", probes));

    StringBuilder query = new StringBuilder();

    for (int i = 0; i < values.size(); i++) {
      String embeddings = Arrays.toString(FloatUtils.toFloatArray(values.get(i)));

      query
          .append("(")
          .append(
              "SELECT id, raw_text, document_date, metadata, namespace, filename, timestamp, \n")
          .append(
              String.format(
                  "%s / (ROW_NUMBER() OVER (ORDER BY text_rank DESC) + %s) + \n",
                  textWeight.getBaseWeight().getValue(), textWeight.getFineTuneWeight()))
          .append(
              String.format(
                  "%s / (ROW_NUMBER() OVER (ORDER BY similarity DESC) + %s) + \n",
                  similarityWeight.getBaseWeight().getValue(),
                  similarityWeight.getFineTuneWeight()))
          .append(
              String.format(
                  "%s / (ROW_NUMBER() OVER (ORDER BY date_rank DESC) + %s) AS rrf_score\n",
                  dateWeight.getBaseWeight().getValue(), dateWeight.getFineTuneWeight()))
          .append("FROM ( ")
          .append(
              "SELECT sv.id, sv.raw_text, sv.namespace, sv.filename, sv.timestamp,"
                  + " svtm.document_date, svtm.metadata, ")
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
              "ELSE EXTRACT(YEAR FROM svtm.document_date) * 365 + EXTRACT(DOY FROM"
                  + " svtm.document_date) ")
          .append("END AS date_rank ")
          .append("FROM ")
          .append(
              String.format(
                  "(SELECT id, raw_text, embedding, tsv, namespace, filename, timestamp from %s"
                      + " WHERE namespace = '%s'",
                  tableName, namespace));

      switch (metric) {
        case COSINE -> query
            .append(" ORDER BY embedding <=> ")
            .append("'")
            .append(embeddings)
            .append("'")
            .append(" LIMIT ")
            .append(topK);
        case IP -> query
            .append(" ORDER BY embedding <#> ")
            .append("'")
            .append(embeddings)
            .append("'")
            .append(" LIMIT ")
            .append(topK);
        case L2 -> query
            .append(" ORDER BY embedding <-> ")
            .append("'")
            .append(embeddings)
            .append("'")
            .append(" LIMIT ")
            .append(topK);
        default -> throw new IllegalArgumentException("Invalid metric: " + metric);
      }
      query
          .append(")")
          .append(" sv ")
          .append("JOIN ")
          .append(tableName.concat("_join_").concat(metadataTableName))
          .append(" jtm ON sv.id = jtm.id ")
          .append("JOIN ")
          .append(tableName.concat("_").concat(metadataTableName))
          .append(" svtm ON jtm.metadata_id = svtm.metadata_id ")
          .append(") subquery ");

      switch (orderRRFBy) {
        case TEXT_RANK -> query.append("ORDER BY text_rank DESC, rrf_score DESC");
        case SIMILARITY -> query.append("ORDER BY similarity DESC, rrf_score DESC");
        case DATE_RANK -> query.append("ORDER BY date_rank DESC, rrf_score DESC");
        case DEFAULT -> query.append("ORDER BY rrf_score DESC");
        default -> throw new IllegalArgumentException("Invalid orderRRFBy value");
      }

      query.append(" LIMIT ").append(topK).append(")");
      if (i < values.size() - 1) {
        query.append(" UNION ALL  ").append("\n");
      }
    }

    if (values.size() > 1) {
      return jdbcTemplate.queryForList(
          String.format(
              "SELECT * FROM (SELECT DISTINCT ON (result.id) * FROM ( %s ) result) subquery ORDER"
                  + " BY rrf_score DESC LIMIT %s;",
              query, upperLimit));
    } else {
      return jdbcTemplate.queryForList(query.toString());
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
