package com.edgechain.lib.flyfly.commands.run;

import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.testcontainers.DockerClientFactory;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.fail;

class TestContainersStarterTest {

  private static final Logger LOGGER = LoggerFactory.getLogger(TestContainersStarterTest.class);

  private TestContainersStarter starter;

  private String tempFilename;

  @BeforeEach
  void setup() {
    tempFilename = org.assertj.core.util.Files.newTemporaryFile().getAbsolutePath();

    starter = new TestContainersStarter();
    starter.setPropertiesPath(tempFilename);
  }

  @AfterEach
  void teardown() {
    new File(tempFilename).delete();
  }

  @Test
  void addTempProperties() {
    try {
      starter.addTempProperties("DAVE");

      List<String> lines =
          org.assertj.core.util.Files.linesOf(new File(tempFilename), StandardCharsets.UTF_8);
      assertEquals(TestContainersStarter.FLYFLYTEMPTAG, lines.get(1));
      assertTrue(lines.get(2).contains("=DAVE"));
      assertEquals(TestContainersStarter.FLYFLYTEMPTAG, lines.get(3));
      assertEquals(TestContainersStarter.FLYFLYTEMPTAG, lines.get(5));
    } catch (IOException e) {
      fail("could not finish test", e);
    }
  }

  @Test
  void addTempAndThenRemove() {
    try {
      Files.writeString(Paths.get(tempFilename), "FIRST LINE\n", StandardCharsets.UTF_8);

      assertTrue(starter.isServiceNeeded());

      starter.addTempProperties("DAVE");
      assertFalse(starter.isServiceNeeded());

      starter.removeTempProperties();
      assertTrue(starter.isServiceNeeded());

      String result = Files.readString(Paths.get(tempFilename), StandardCharsets.UTF_8);
      assertEquals("FIRST LINE\n\n", result); // addTemp.. adds a blank line at the start
    } catch (IOException e) {
      fail("could not finish test", e);
    }
  }

  @Test
  void startAndStopContainer() {
    if (!isDockerAvailable()) {
      LOGGER.warn("Docker is not running - test skipped");
      return;
    }

    try {
      starter.startPostgreSQL();
    } catch (IOException e) {
      fail("not able to start PostgreSQL", e);
    } finally {
      try {
        starter.stopPostgreSQL();
      } catch (IOException e2) {
        fail("failed to stop PostgreSQL", e2);
      }
    }
  }

  boolean isDockerAvailable() {
    try {
      DockerClientFactory.instance().client();
      return true;
    } catch (Throwable ex) {
      return false;
    }
  }
}
