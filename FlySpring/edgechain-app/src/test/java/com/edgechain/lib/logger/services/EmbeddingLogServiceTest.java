package com.edgechain.lib.logger.services;

import org.junit.jupiter.api.Test;
import org.postgresql.ds.PGSimpleDataSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.util.ReflectionTestUtils;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Testcontainers;
import static org.junit.jupiter.api.Assertions.fail;

@Testcontainers(disabledWithoutDocker = true)
class EmbeddingLogServiceTest {

  private static PostgresTestContainer instance = new PostgresTestContainer();

  @Test
  void test() {
    instance.start();
    try {
      // create datasource and template using Docker properties
      final PGSimpleDataSource datasource = new PGSimpleDataSource();
      datasource.setUrl(instance.getJdbcUrl());
      datasource.setUser(instance.getUsername());
      datasource.setPassword(instance.getPassword());

      final JdbcTemplate template = new JdbcTemplate(datasource);

      // create service using template
      final EmbeddingLogService service = new EmbeddingLogService();
      ReflectionTestUtils.setField(service, "jdbcTemplate", template);

      service.createTable();

    } catch (Exception e) {
      fail("could not create table", e);

    } finally {
      instance.stop();
    }
  }

  public static class PostgresTestContainer extends PostgreSQLContainer<PostgresTestContainer> {

    private static final Logger LOGGER = LoggerFactory.getLogger(PostgresTestContainer.class);

    private static final String DOCKER_IMAGE =
        PostgreSQLContainer.IMAGE + ":" + PostgreSQLContainer.DEFAULT_TAG;

    public PostgresTestContainer() {
      super(DOCKER_IMAGE);
    }

    @Override
    public void start() {
      LOGGER.info("starting container");
      super.start();
    }

    @Override
    public void stop() {
      LOGGER.info("stopping container");
      super.stop();
    }
  }
}
