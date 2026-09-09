package com.edgechain.lib.context.client.repositories;

import com.edgechain.lib.context.domain.HistoryContext;
import com.edgechain.testutil.PostgresTestContainer;
import org.junit.jupiter.api.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.jdbc.Sql;

import java.time.LocalDateTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Sql(scripts = {"classpath:schema.sql"})
class PostgreSQLHistoryContextRepositoryTest {

  Logger logger = LoggerFactory.getLogger(getClass());

  @Autowired private PostgreSQLHistoryContextRepository repository;

  private static final PostgresTestContainer instance =
      new PostgresTestContainer(PostgresTestContainer.PostgresImage.VECTOR);

  @BeforeAll
  static void setupAll() {
    instance.start();
  }

  @AfterAll
  static void tearAll() {
    instance.stop();
  }

  @BeforeEach
  void setUp() {
    repository.deleteAll();
  }

  @DynamicPropertySource
  static void setProperties(DynamicPropertyRegistry registry) {
    registry.add("spring.datasource.url", instance::getJdbcUrl);
    registry.add("spring.datasource.username", instance::getUsername);
    registry.add("spring.datasource.password", instance::getPassword);
  }

  @Test
  void test_Save_And_Retrieve_History_Context() {
    HistoryContext historyContext = getHistoryContext();
    repository.save(historyContext);

    Optional<HistoryContext> result = repository.findById("1");
    logger.info("history context {}", result);

    assertTrue(result.isPresent());
  }

  @Test
  void test_Delete_History_Context() {
    HistoryContext historyContext = getHistoryContext();
    repository.save(historyContext);

    repository.deleteById("1");
    Optional<HistoryContext> result = repository.findById("1");

    assertTrue(result.isEmpty());
  }

  @Test
  void test_Find_By_Non_Exist_Context() {
    Optional<HistoryContext> result = repository.findById("10");
    assertTrue(result.isEmpty());
  }

  private HistoryContext getHistoryContext() {
    return new HistoryContext("1", "testing history context", LocalDateTime.now());
  }
}
