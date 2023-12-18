package com.edgechain.lib.flyfly.commands.run;

import com.edgechain.lib.flyfly.utils.ProjectSetup;
import jakarta.annotation.PreDestroy;
import java.io.BufferedReader;
import java.io.FileReader;
import java.io.IOException;
import java.nio.file.FileSystems;
import java.nio.file.FileVisitResult;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.SimpleFileVisitor;
import java.nio.file.WatchEvent;
import java.nio.file.WatchKey;
import java.nio.file.WatchService;
import java.nio.file.attribute.BasicFileAttributes;
import java.util.Set;
import java.util.concurrent.TimeUnit;
import org.apache.commons.lang3.SystemUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.zeroturnaround.exec.ProcessExecutor;
import static java.nio.file.StandardWatchEventKinds.ENTRY_CREATE;
import static java.nio.file.StandardWatchEventKinds.ENTRY_DELETE;
import static java.nio.file.StandardWatchEventKinds.ENTRY_MODIFY;

@Component
public class ProjectRunner {

  private final Logger logger = LoggerFactory.getLogger(this.getClass());

  @Autowired TestContainersStarter testContainersStarter;
  @Autowired ProjectSetup projectSetup;

  Process runningProcess;
  WatchService filesWatcher;
  WatchService buildFileWatcher;
  boolean allowInfrastructureServices;

  public void run() {
    try {
      logger.info("Configuring the project");
      logger.info("Checking if initscript exists");
      if (!projectSetup.initscriptExists()) {
        logger.info("Initscript doesn't exist");
        logger.info("Adding flyfly.gradle to initscripts");
        projectSetup.addInitscript();
      }
      projectSetup.addAutorouteJar();
      allowInfrastructureServices = isDockerInstalled();
      if (allowInfrastructureServices) checkAndConfigureServices();
      logger.debug("registering watcher for src files changes");
      registerFilesWatcher();
      logger.debug("registering watcher for build file changes");
      registerBuildFileWatcher();
      logger.info("Starting the project");
      runTheProject();
      loop();

    } catch (InterruptedException ie) {
      logger.warn("interrupted", ie);
      Thread.currentThread().interrupt();

    } catch (Exception e) {
      logger.error("failed", e);
    }
  }

  boolean isDockerInstalled() throws IOException, InterruptedException {
    logger.info("Checking if docker is installed to allow infrastructure services");
    int exitCode;
    try {
      String[] command;
      if (SystemUtils.IS_OS_WINDOWS) command = new String[] {"cmd", "/c", "docker", "info"};
      else command = new String[] {"docker", "info"};

      exitCode = new ProcessExecutor().command(command).start().getProcess().waitFor();

    } catch (InterruptedException ie) {
      logger.warn("interrupted", ie);
      Thread.currentThread().interrupt();
      exitCode = -1;

    } catch (Exception e) {
      logger.error("failed", e);
      exitCode = -1;
    }

    if (exitCode != 0) {
      logger.warn("Couldn't find docker. Disabling infrastructure services.");
      return false;
    }
    return true;
  }

  void runTheProject() throws IOException {
    String[] command;
    if (SystemUtils.IS_OS_WINDOWS) command = new String[] {"cmd", "/c", "gradlew.bat", "bootRun"};
    else command = new String[] {"./gradlew", "bootRun"};

    runningProcess =
        new ProcessExecutor().command(command).redirectOutput(System.out).start().getProcess();
  }

  void checkAndConfigureServices() throws IOException {
    logger.info("Checking if services are needed");
    // Set<String> supportedDBGroupIds =
    // Set.of("mysql", "com.mysql", "org.postgresql", "org.mariadb.jdbc");
    Set<String> supportedDBGroupIds = Set.of("org.postgresql");
    BufferedReader reader = new BufferedReader(new FileReader("build.gradle"));
    String line;
    while ((line = reader.readLine()) != null) {
      if (line.contains("dependencies")) {
        while ((line = reader.readLine()) != null) {
          int start = line.indexOf("\'");
          int end = line.indexOf(":");
          if (start < 0 || end < 0) continue;
          String groupID = line.substring(start + 1, end);
          if (supportedDBGroupIds.contains(groupID)) {
            if (!testContainersStarter.isServiceNeeded()) break;
            logger.info("Found : {}", groupID);
            switch (groupID) {
                // case "mysql", "com.mysql" -> testContainersStarter.startMySQL();
              case "org.postgresql" -> testContainersStarter.startPostgreSQL();
                // case "org.mariadb.jdbc" -> testContainersStarter.startMariaDB();
            }
            break;
          }
        }
        break;
      }
    }
    reader.close();
  }

  void registerBuildFileWatcher() throws IOException {
    Path path = Paths.get("");
    buildFileWatcher = FileSystems.getDefault().newWatchService();
    path.register(buildFileWatcher, ENTRY_CREATE, ENTRY_DELETE, ENTRY_MODIFY);
  }

  public void loop() throws IOException, InterruptedException {
    while (true) {
      if (didFilesChange() && runningProcess.isAlive()) {
        reloadTheProject();
      }
      if (didBuildFileChange()) {
        handleBuildFileChange();
      }
    }
  }

  void registerFilesWatcher() throws IOException {
    Path path = Paths.get("src");
    filesWatcher = FileSystems.getDefault().newWatchService();
    Files.walkFileTree(
        path,
        new SimpleFileVisitor<Path>() {
          @Override
          public FileVisitResult preVisitDirectory(Path dir, BasicFileAttributes attrs)
              throws IOException {
            dir.register(filesWatcher, ENTRY_CREATE, ENTRY_DELETE, ENTRY_MODIFY);
            return FileVisitResult.CONTINUE;
          }
        });
  }

  void reloadTheProject() throws IOException, InterruptedException {
    destroyRunningProcess();
    runTheProject();
  }

  boolean didFilesChange() throws InterruptedException {
    WatchKey key = filesWatcher.poll(500, TimeUnit.MILLISECONDS);
    if (key == null) return false;
    for (WatchEvent<?> event : key.pollEvents()) {}
    key.reset();
    if (!runningProcess.isAlive()) return false;
    return true;
  }

  boolean didBuildFileChange() throws InterruptedException {
    WatchKey key = buildFileWatcher.poll(500, TimeUnit.MILLISECONDS);
    if (key == null) return false;
    boolean found = false;
    for (WatchEvent<?> event : key.pollEvents()) {
      Path p = (Path) event.context();
      if (p.endsWith("build.gradle")) found = true;
    }
    key.reset();
    if (found) logger.info("Detected build file change ...");
    return found;
  }

  void handleBuildFileChange() throws IOException, InterruptedException {
    destroyRunningProcess();
    if (allowInfrastructureServices) checkAndConfigureServices();
    runTheProject();
  }

  @PreDestroy
  void destroyRunningProcess() throws InterruptedException, IOException {
    if (runningProcess == null) return;
    if (SystemUtils.IS_OS_WINDOWS) {
      Runtime.getRuntime().exec("cmd.exe /c taskkill /f /t /pid " + runningProcess.pid()).waitFor();
    } else runningProcess.destroy();
  }
}
