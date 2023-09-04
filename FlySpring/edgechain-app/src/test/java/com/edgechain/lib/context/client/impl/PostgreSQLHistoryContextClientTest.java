package com.edgechain.lib.context.client.impl;

import com.edgechain.lib.context.domain.HistoryContext;
import com.edgechain.lib.rxjava.transformer.observable.EdgeChain;
import com.edgechain.testutil.PostgresTestContainer;
import com.edgechain.testutil.PostgresTestContainer.PostgresImage;
import com.zaxxer.hikari.HikariConfig;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.SpringBootTest.WebEnvironment;
import org.springframework.test.annotation.DirtiesContext;
import org.testcontainers.junit.jupiter.Testcontainers;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;

@Testcontainers(disabledWithoutDocker = true)
@SpringBootTest(webEnvironment = WebEnvironment.NONE)
@DirtiesContext
class PostgreSQLHistoryContextClientTest {

  private static final Logger LOGGER =
      LoggerFactory.getLogger(PostgreSQLHistoryContextClientTest.class);

  private static PostgresTestContainer instance = new PostgresTestContainer(PostgresImage.PLAIN);

  @BeforeAll
  static void baseSetupAll() {
    instance.start();
  }

  @AfterAll
  static void baseTeardownAll() {
    instance.stop();
  }

  @Autowired private HikariConfig hikariConfig;
  @Autowired private PostgreSQLHistoryContextClient service;

  @Test
  void allMethods() {
    // hikari has own copy of properties so set these here
    hikariConfig.setJdbcUrl(instance.getJdbcUrl());
    hikariConfig.setUsername(instance.getUsername());
    hikariConfig.setPassword(instance.getPassword());

    final Data data = new Data();

    final EdgeChain<HistoryContext> create = service.create("DAVE", null);
    create.toSingle().blockingSubscribe(s -> data.id = s.getId(), e -> data.failed = true);
    assertFalse(data.failed);
    assertNotNull(data.id);
    LOGGER.info("create OK id={}", data.id);

    final EdgeChain<HistoryContext> put = service.put(data.id, "COW", null);
    put.toSingle().blockingSubscribe(s -> {}, e -> data.failed = true);
    assertFalse(data.failed);
    LOGGER.info("put OK");

    final EdgeChain<HistoryContext> get = service.get(data.id, null);
    get.toSingle().blockingSubscribe(s -> data.val = s.getResponse(), e -> data.failed = true);
    assertFalse(data.failed);
    assertEquals("COW", data.val);
    LOGGER.info("get OK val={}", data.val);

    EdgeChain<String> delete = service.delete(data.id, null);
    delete.toSingle().blockingSubscribe(s -> data.val = s, e -> data.failed = true);
    assertFalse(data.failed);
    assertEquals("", data.val);
    LOGGER.info("delete OK val={}", data.val);

    final EdgeChain<HistoryContext> getMissing = service.get("not_there", null);
    getMissing
        .toSingle()
        .blockingSubscribe(s -> data.failed = true, e -> data.val = e.getMessage());
    assertFalse(data.failed);
    assertEquals("PostgreSQL history_context id isn't found.", data.val);
    LOGGER.info("get-NotFound OK val={}", data.val);
  }

  private static class Data {
    public boolean failed;
    public String id;
    public String val;
  }
}
