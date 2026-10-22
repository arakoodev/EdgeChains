package com.edgechain.lib.flyfly.commands.run;

import jakarta.annotation.PreDestroy;
import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.FileReader;
import java.io.FileWriter;
import java.io.IOException;
import java.nio.file.FileSystems;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.testcontainers.containers.PostgreSQLContainer;

@Component
public class TestContainersStarter {

  private final Logger log = LoggerFactory.getLogger(this.getClass());

  private static final String DBNAME = "test";
  private static final String USERNAME = "test";
  private static final String PASSWORD = "test";
  // private MySQLContainer<?> mysql;
  private PostgreSQLContainer<?> postgre;
  // private MariaDBContainer<?> mariaDB;
  static final String FLYFLYTEMPTAG = "#flyfly_temp_property";

  private String propertiesPath;

  public TestContainersStarter() {
    propertiesPath = buildPropertiesPath();
  }

  public String getPropertiesPath() {
    return propertiesPath;
  }

  public void setPropertiesPath(String propertiesPath) {
    this.propertiesPath = propertiesPath;
  }

  // public void startMySQL() throws IOException {
  // if (mysql != null && mysql.isRunning()) return;
  // log.info("Starting a temporary MySQL database.");
  // mysql =
  // new MySQLContainer<>(DockerImageName.parse("mysql:5.7"))
  // .withDatabaseName(dbName)
  // .withUsername(userName)
  // .withPassword(password);
  // mysql.addParameter("TC_MY_CNF", null);
  // mysql.start();
  // log.info("Database started.");
  // log.info("DB URL: " + mysql.getJdbcUrl());
  // log.info("DB Username: " + mysql.getUsername());
  // log.info("DB Password: " + mysql.getPassword());
  // addTempProperties(mysql.getJdbcUrl());
  // }

  public void startPostgreSQL() throws IOException {
    if (postgre != null && postgre.isRunning()) return;
    log.info("Starting a temporary PostgreSQL database.");
    postgre =
        new PostgreSQLContainer<>("postgres:14.5")
            .withDatabaseName(DBNAME)
            .withUsername(USERNAME)
            .withPassword(PASSWORD);
    postgre.addParameter("TC_MY_CNF", null);
    postgre.start();

    log.info("Database started.");
    log.info("DB URL: {}", postgre.getJdbcUrl());
    log.info("DB Username: {}", postgre.getUsername());
    log.info("DB Password: {}", postgre.getPassword());

    addTempProperties(postgre.getJdbcUrl());
  }

  public void stopPostgreSQL() throws IOException {
    try {
      removeTempProperties();
    } catch (IOException e) {
    }
    // if (mysql != null && mysql.isRunning()) mysql.close();
    log.info("Stopping temporary PostgreSQL database.");
    if (postgre != null && postgre.isRunning()) postgre.close();
    // if (mariaDB != null && mariaDB.isRunning()) mariaDB.close();
  }

  // public void startMariaDB() throws IOException {
  // if (postgre != null && postgre.isRunning()) return;
  // log.info("Starting a temporary MariaDB database.");
  // mariaDB =
  // new MariaDBContainer<>("mariadb:10.3.6")
  // .withDatabaseName(dbName)
  // .withUsername(userName)
  // .withPassword(password);
  // mariaDB.addParameter("TC_MY_CNF", null);
  // mariaDB.start();
  // log.info("Database started.");
  // log.info("DB URL: " + mariaDB.getJdbcUrl());
  // log.info("DB Username: " + mariaDB.getUsername());
  // log.info("DB Password: " + mariaDB.getPassword());
  // addTempProperties(mariaDB.getJdbcUrl());
  // }

  public void addTempProperties(String url) throws IOException {
    log.info("Appending temporary DB configuration to application.properties");
    try (FileWriter fw = new FileWriter(propertiesPath, true);
        BufferedWriter writer = new BufferedWriter(fw)) {
      writer.newLine();
      writer.append(FLYFLYTEMPTAG);
      writer.newLine();
      writer.append("spring.datasource.url=").append(url);
      writer.newLine();
      writer.append(FLYFLYTEMPTAG);
      writer.newLine();
      writer.append("spring.datasource.username=").append(USERNAME);
      writer.newLine();
      writer.append(FLYFLYTEMPTAG);
      writer.newLine();
      writer.append("spring.datasource.password=").append(PASSWORD);
      writer.flush();
    }
  }

  public void removeTempProperties() throws IOException {
    log.info("Removing temporary DB configuration from application.properties");
    boolean tempNotFound = true;
    StringBuilder sb = new StringBuilder();
    try (FileReader fr = new FileReader(propertiesPath);
        BufferedReader reader = new BufferedReader(fr)) {
      String line;
      while ((line = reader.readLine()) != null) {
        if (line.contains(FLYFLYTEMPTAG)) {
          tempNotFound = false;
          reader.readLine(); // skip next line
          continue;
        }
        sb.append(line).append("\n");
      }
    }
    if (tempNotFound) return;

    try (FileWriter fw = new FileWriter(propertiesPath);
        BufferedWriter writer = new BufferedWriter(fw)) {
      writer.write(sb.toString());
      writer.flush();
    }
  }

  public boolean isServiceNeeded() throws IOException {
    final String datafield = "spring.datasource.url";
    try (FileReader fr = new FileReader(propertiesPath);
        BufferedReader reader = new BufferedReader(fr)) {
      String line;
      while ((line = reader.readLine()) != null) {
        if (line.contains(datafield)) {
          return false;
        }
      }
    }
    return true;
  }

  private static String buildPropertiesPath() {
    String separator = FileSystems.getDefault().getSeparator();
    return System.getProperty("user.dir")
        + separator
        + "src"
        + separator
        + "main"
        + separator
        + "resources"
        + separator
        + "application.properties";
  }

  @PreDestroy
  public void destroy() {
    try {
      stopPostgreSQL();
    } catch (IOException e) {
    }
  }
}
