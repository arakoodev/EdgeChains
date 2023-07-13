package com.edgechain.lib.index.client.impl;

import com.edgechain.lib.embeddings.WordEmbeddings;
import com.edgechain.lib.endpoint.impl.PostgresEndpoint;
import com.edgechain.lib.index.enums.PostgresDistanceMetric;
import com.edgechain.lib.response.StringResponse;
import com.edgechain.lib.rxjava.transformer.observable.EdgeChain;
import com.edgechain.lib.utils.FloatUtils;
import io.reactivex.rxjava3.core.Observable;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceUtils;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

import java.sql.Connection;
import java.util.*;

public class PostgresClient {

  private final PostgresEndpoint postgresEndpoint;
  private final DriverManagerDataSource dataSource;

  public PostgresClient(PostgresEndpoint postgresEndpoint) {
    this.postgresEndpoint = postgresEndpoint;
    this.dataSource = initDataSource(postgresEndpoint);
  }

  public EdgeChain<StringResponse> upsert(WordEmbeddings wordEmbeddings) {
    return new EdgeChain<>(
        Observable.create(
            emitter -> {
              Connection conn = null;
              try {
                JdbcTemplate jdbcTemplate = new JdbcTemplate(this.dataSource);

                conn =
                    DataSourceUtils.getConnection(
                        Objects.requireNonNull(jdbcTemplate.getDataSource()));
                conn.setAutoCommit(false);

                jdbcTemplate.execute("CREATE EXTENSION IF NOT EXISTS vector;");
                jdbcTemplate.execute(
                    String.format(
                        "CREATE TABLE IF NOT EXISTS %s (id TEXT PRIMARY KEY, embedding"
                            + " vector(%s));",
                        postgresEndpoint.getTableName(), postgresEndpoint.getDimensions()));

                String input = wordEmbeddings.getId().replaceAll("'", "");

                jdbcTemplate.execute(
                    String.format(
                        "INSERT INTO %s (id, embedding) VALUES ('%s', '%s')\n"
                            + "    ON CONFLICT (id) DO UPDATE SET embedding = EXCLUDED.embedding;",
                        postgresEndpoint.getTableName(),
                        input,
                        Arrays.toString(FloatUtils.toFloatArray(wordEmbeddings.getValues()))));

                conn.commit();
                conn.setAutoCommit(true);

                emitter.onNext(new StringResponse("Upserted"));
                emitter.onComplete();

              } catch (final Exception e) {
                if (Objects.nonNull(conn)) {
                  conn.rollback();
                }
                emitter.onError(e);
              }
            }),
        postgresEndpoint);
  }

  public EdgeChain<List<WordEmbeddings>> query(
      WordEmbeddings wordEmbeddings, PostgresDistanceMetric metric, int topK) {
    return new EdgeChain<>(
        Observable.create(
            emitter -> {
              try {
                JdbcTemplate jdbcTemplate = new JdbcTemplate(this.dataSource);

                List<Map<String, Object>> rows =
                    jdbcTemplate.queryForList(
                        String.format(
                            "SELECT id FROM %s ORDER BY embedding %s '%s' LIMIT %s;",
                            this.postgresEndpoint.getTableName(),
                            PostgresDistanceMetric.getDistanceMetric(metric),
                            Arrays.toString(FloatUtils.toFloatArray(wordEmbeddings.getValues())),
                            topK));

                List<WordEmbeddings> wordEmbeddingsList = new ArrayList<>();

                for (Map row : rows) {
                  wordEmbeddingsList.add(new WordEmbeddings((String) row.get("id")));
                }

                emitter.onNext(wordEmbeddingsList);
                emitter.onComplete();

              } catch (final Exception e) {
                emitter.onError(e);
              }
            }),
        postgresEndpoint);
  }

  public EdgeChain<StringResponse> deleteAll() {
    return new EdgeChain<>(
        Observable.create(
            emitter -> {
              Connection conn = null;
              try {
                JdbcTemplate jdbcTemplate = new JdbcTemplate(this.dataSource);

                conn =
                    DataSourceUtils.getConnection(
                        Objects.requireNonNull(jdbcTemplate.getDataSource()));
                conn.setAutoCommit(false);

                jdbcTemplate.execute(
                    String.format("DROP TABLE IF EXISTS %s;", postgresEndpoint.getTableName()));

                conn.commit();
                conn.setAutoCommit(true);

                emitter.onNext(new StringResponse("Word embeddings are successfully deleted."));
                emitter.onComplete();

              } catch (final Exception e) {
                if (Objects.nonNull(conn)) {
                  conn.rollback();
                }
                emitter.onError(e);
              }
            }),
        postgresEndpoint);
  }

  private DriverManagerDataSource initDataSource(PostgresEndpoint postgresEndpoint) {
    DriverManagerDataSource dataSource = new DriverManagerDataSource();
    dataSource.setDriverClassName("org.postgresql.Driver");
    dataSource.setUrl(postgresEndpoint.getJdbcUrl());
    dataSource.setUsername(postgresEndpoint.getUsername());
    dataSource.setPassword(postgresEndpoint.getPassword());
    return dataSource;
  }
}
