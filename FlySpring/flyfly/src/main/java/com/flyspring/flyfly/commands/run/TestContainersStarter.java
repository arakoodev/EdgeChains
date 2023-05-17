package com.flyspring.flyfly.commands.run;

import java.io.*;
import java.nio.file.FileSystems;

import org.springframework.stereotype.Component;
import org.testcontainers.containers.MariaDBContainer;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;

@Component
@Slf4j
public class TestContainersStarter {
  private static final String dbName = "test";
  private static final String userName = "test";
  private static final String password = "test";
  private MySQLContainer<?> mysql;
  private PostgreSQLContainer<?> postgre;
  private MariaDBContainer<?> mariaDB;
  private String flyflyTempTag = "#flyfly_temp_property";

  public void startMySQL() throws IOException {
    if (mysql != null && mysql.isRunning()) return;
    log.info("Starting a temporary MySQL database.");
    mysql =
        new MySQLContainer<>(DockerImageName.parse("mysql:5.7"))
            .withDatabaseName(dbName)
            .withUsername(userName)
            .withPassword(password);
    mysql.addParameter("TC_MY_CNF", null);
    mysql.start();
    log.info("Database started.");
    log.info("DB URL: " + mysql.getJdbcUrl());
    log.info("DB Username: " + mysql.getUsername());
    log.info("DB Password: " + mysql.getPassword());
    addTempProperties(mysql.getJdbcUrl());
  }

  public void startPostgreSQL() throws IOException {
    if (postgre != null && postgre.isRunning()) return;
    log.info("Starting a temporary PostgreSQL database.");
    postgre =
        new PostgreSQLContainer<>("postgres:14.5")
            .withDatabaseName(dbName)
            .withUsername(userName)
            .withPassword(password);
    postgre.addParameter("TC_MY_CNF", null);
    postgre.start();
    log.info("Database started.");
    log.info("DB URL: " + postgre.getJdbcUrl());
    log.info("DB Username: " + postgre.getUsername());
    log.info("DB Password: " + postgre.getPassword());
    addTempProperties(postgre.getJdbcUrl());
  }

  public void startMariaDB() throws IOException {
    if (postgre != null && postgre.isRunning()) return;
    log.info("Starting a temporary MariaDB database.");
    mariaDB =
        new MariaDBContainer<>("mariadb:10.3.6")
            .withDatabaseName(dbName)
            .withUsername(userName)
            .withPassword(password);
    mariaDB.addParameter("TC_MY_CNF", null);
    mariaDB.start();
    log.info("Database started.");
    log.info("DB URL: " + mariaDB.getJdbcUrl());
    log.info("DB Username: " + mariaDB.getUsername());
    log.info("DB Password: " + mariaDB.getPassword());
    addTempProperties(mariaDB.getJdbcUrl());
  }

  public void addTempProperties(String url) throws IOException {
    log.info("Appending temporary DB configuration to application.properties");
    BufferedWriter writer = new BufferedWriter(new FileWriter(getPropertiesPath(), true));
    writer.newLine();
    writer.append(flyflyTempTag);
    writer.newLine();
    writer.append("spring.datasource.url=" + url);
    writer.newLine();
    writer.append(flyflyTempTag);
    writer.newLine();
    writer.append("spring.datasource.username=" + userName);
    writer.newLine();
    writer.append(flyflyTempTag);
    writer.newLine();
    writer.append("spring.datasource.password=" + password);
    writer.flush();
    writer.close();
  }

  public void removeTempProperties() throws IOException {
    BufferedReader reader = new BufferedReader(new FileReader(getPropertiesPath()));
    StringBuilder sb = new StringBuilder();
    boolean tempNotFound = true;
    String line;
    while ((line = reader.readLine()) != null) {
      if (line.contains(flyflyTempTag)) {
        tempNotFound = false;
        reader.readLine();
        continue;
      }
      sb.append(line + "\n");
    }
    reader.close();
    if (tempNotFound) return;

    BufferedWriter writer = new BufferedWriter(new FileWriter(getPropertiesPath()));
    writer.write(sb.toString());
    writer.flush();
    writer.close();
  }

  public boolean isServiesNeeded() throws IOException {
    BufferedReader reader = new BufferedReader(new FileReader(getPropertiesPath()));
    String line;
    String datafield = "spring.datasource.url";
    while ((line = reader.readLine()) != null) {
      if (line.contains(datafield)) {
        reader.close();
        return false;
      }
    }
    reader.close();
    return true;
  }

  public String getPropertiesPath() {
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
      removeTempProperties();
    } catch (IOException e) {
    }
    if (mysql != null && mysql.isRunning()) mysql.close();
    if (postgre != null && postgre.isRunning()) postgre.close();
    if (mariaDB != null && mariaDB.isRunning()) mariaDB.close();
  }
}
