package com.edgechain.testutil;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

public class PostgresTestContainer extends PostgreSQLContainer<PostgresTestContainer> {

  public enum PostgresImage {
    PLAIN,
    VECTOR
  };

  private static final Logger LOGGER = LoggerFactory.getLogger(PostgresTestContainer.class);

  //  private static final String DOCKER_IMAGE = PostgreSQLContainer.IMAGE + ":" +
  // PostgreSQLContainer.DEFAULT_TAG;

  private static final DockerImageName IMAGE = DockerImageName.parse("postgres").withTag("14.5");

  private static final DockerImageName VECTOR_IMAGE =
      DockerImageName.parse("ankane/pgvector").asCompatibleSubstituteFor("postgres");

  public PostgresTestContainer(PostgresImage img) {
    super(img == PostgresImage.VECTOR ? VECTOR_IMAGE : IMAGE);
  }

  @Override
  public void start() {
    LOGGER.info("starting container");
    super.start();
    LOGGER.info("TEST with Docker PostgreSQL url={}", getJdbcUrl());
  }

  @Override
  public void stop() {
    LOGGER.info("stopping container");
    super.stop();
  }
}
