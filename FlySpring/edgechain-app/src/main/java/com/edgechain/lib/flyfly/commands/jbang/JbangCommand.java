package com.edgechain.lib.flyfly.commands.jbang;

import java.io.*;
import java.util.HashMap;
import java.util.Objects;

import com.edgechain.lib.utils.JsonUtils;
import org.apache.commons.exec.OS;
import org.apache.commons.io.FileUtils;
import org.apache.commons.lang3.SystemUtils;
import org.springframework.stereotype.Component;
import picocli.CommandLine.Command;
import picocli.CommandLine.Parameters;

@Component
@Command(
    name = "jbang",
    description = "Activate jbang i.e., java -jar edgechain.jar jbang Hello.java")
public class JbangCommand implements Runnable {

  @Parameters(description = "Java file to be executed with jbang;")
  private String javaFile;

  @Override
  public void run() {

    InputStream inputStream = this.getClass().getResourceAsStream("/jbang.jar");

    if (Objects.isNull(inputStream))
      throw new RuntimeException("Unable to find jbang.jar in resource directory");

    File jbangJar = new File(System.getProperty("java.io.tmpdir") + File.separator + "jbang.jar");

    try {
      FileUtils.copyInputStreamToFile(inputStream, jbangJar);
    } catch (IOException e) {
      throw new RuntimeException(e);
    }

    jbangJar.deleteOnExit();

    // Clear Jbang Cache
    clearCache(jbangJar);

    // Build Jar using Jbang
    buildJar(jbangJar, this.javaFile);

    // Get Information
    JbangResponse jbangResponse = info(jbangJar, this.javaFile);

    String classPath;
    if (OS.isFamilyWindows()) {
      classPath = jbangResponse.getApplicationJar().concat(";") + System.getProperty("jar.name");
    }
    else if(OS.isFamilyUnix()){
      classPath = jbangResponse.getApplicationJar().concat(":") + System.getProperty("jar.name");
    }
    else if(OS.isFamilyMac()) {
      classPath = jbangResponse.getApplicationJar().concat(":") + System.getProperty("jar.name");
    }
    else {
      classPath = jbangResponse.getApplicationJar().concat(":") + System.getProperty("jar.name");
    }


    // Execute
    execute(classPath, jbangResponse.getMainClass());
  }

  private void clearCache(File jbangJar) {

    try {
      ProcessBuilder pb =
          new ProcessBuilder("java", "-jar", jbangJar.getAbsolutePath(), "cache", "clear")
              .inheritIO();

      Process process = pb.start();
      process.waitFor();

    } catch (IOException | InterruptedException e) {
      throw new RuntimeException(e);
    }
  }

  private void buildJar(File jbangJar, String javaFile) {

    try {
      ProcessBuilder pb =
          new ProcessBuilder(
                  "java",
                  "-jar",
                  jbangJar.getAbsolutePath(),
                  "--cp",
                  System.getProperty("jar.name"),
                  javaFile)
              .inheritIO()
              .redirectErrorStream(true);
      Process process = pb.start();
      process.waitFor();
    } catch (InterruptedException | IOException e) {
      throw new RuntimeException(e);
    }
  }

  private JbangResponse info(File jbangJar, String javaFile) {

    try {
      ProcessBuilder pb =
          new ProcessBuilder(
              "java",
              "-jar",
              jbangJar.getAbsolutePath(),
              "info",
              "tools",
              "--cp",
              System.getProperty("jar.name"),
              javaFile);

      Process process = pb.start();

      BufferedReader bufferedReader =
          new BufferedReader(new InputStreamReader(process.getInputStream()));

      StringBuilder appender = new StringBuilder();

      String line;
      while ((line = bufferedReader.readLine()) != null) {
        appender.append(line);
      }

      process.waitFor();
      bufferedReader.close();
      return JsonUtils.convertToObject(appender.toString(), JbangResponse.class);

    } catch (IOException | InterruptedException e) {
      throw new RuntimeException(e);
    }
  }

  private void execute(String classPath, String mainClass) {

    try {

      ProcessBuilder pb =
          new ProcessBuilder("java", "-classpath", classPath, mainClass).inheritIO();

      Process process = pb.start();

      process.waitFor();

    } catch (IOException | InterruptedException e) {
      throw new RuntimeException(e);
    }
  }
}
