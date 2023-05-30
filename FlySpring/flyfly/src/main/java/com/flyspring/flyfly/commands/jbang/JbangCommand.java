package com.flyspring.flyfly.commands.jbang;

import org.springframework.stereotype.Component;
import picocli.CommandLine.Command;
import picocli.CommandLine.Parameters;

import java.io.*;

@Component
@Command(name = "jbang", description = "Activate jbang through the jar placed in resources")
public class JbangCommand implements Runnable {

  @Parameters(description = "Java file to be executed with jbang")
  private String javaFile;

  @Parameters(description = "ClassPath Jar to be used")
  private String classPathJar;

  @Override
  public void run() {
    String resourcePath = "/jbang.jar";
    try {
      File jarFile = extractFileFromResources(resourcePath);
      if (jarFile != null) {
        runJbang(jarFile, javaFile, classPathJar);
      } else {
        System.out.println("Could not find jbang.jar in resources.");
      }
    } catch (IOException e) {
      e.printStackTrace();
    }
  }

  private File extractFileFromResources(String resourcePath) throws IOException {
    InputStream inputStream = getClass().getResourceAsStream(resourcePath);
    if (inputStream == null) {
      return null;
    }
    File jarFile = File.createTempFile("jbang", ".jar");
    jarFile.deleteOnExit();
    try (FileOutputStream outputStream = new FileOutputStream(jarFile)) {
      inputStream.transferTo(outputStream);
    }
    return jarFile;
  }

  private void runJbang(File jarFile, String javaFile, String classPathJar) {
    try {
      String osName = System.getProperty("os.name").toLowerCase();
      ProcessBuilder pb;

      if (osName.contains("win")) {
        pb = new ProcessBuilder(
            "cmd.exe",
            "/c",
            "java",
            "-cp",
            jarFile.getAbsolutePath(),
            "dev.jbang.Main",
            "--cp",
            classPathJar,
            javaFile);
      } else if (osName.contains("nix") || osName.contains("nux") || osName.contains("mac")) {
        pb = new ProcessBuilder(
            "java", "-cp", "jbang.jar", "dev.jbang.Main", "--cp", classPathJar, javaFile);
      } else {
        System.err.println("Unsupported operating system: " + osName);
        return;
      }

      pb.redirectErrorStream(true);
      Process process = pb.start();
      BufferedReader bufferedReader = new BufferedReader(new InputStreamReader(process.getInputStream()));
      String classPath = extractClassPathFromOutput(bufferedReader);

      // The mainClass accepts any class name provided from the javaFile
      String mainClass = extractMainClassFromOutput(bufferedReader, javaFile);
      System.out.println("Extracted Classpath: " + classPath);
      System.out.println("Main Class: " + mainClass);

      process.waitFor();

      // Step Two: Execute the final command with the extracted classpath
      if (classPath != null && !classPath.isEmpty() && mainClass != null && !mainClass.isEmpty()) {
        runJavaWithClassPath(classPath, mainClass);
      } else {
        System.out.println("Could not extract classpath or main class from the output.");
      }
    } catch (IOException | InterruptedException e) {
      e.printStackTrace();
    }
  }

  private String extractClassPathFromOutput(BufferedReader bufferedReader) throws IOException {
    String line;
    String classPath = null;
    final String pattern = "-classpath '";
    while ((line = bufferedReader.readLine()) != null) {
      System.out.println("Line: " + line); // added debug message
      int startIndex = line.indexOf(pattern);
      if (startIndex > -1) {
        startIndex += pattern.length();
        int endIndex = line.indexOf('\'', startIndex);
        if (endIndex > startIndex) {
          classPath = line.substring(startIndex, endIndex);
          break;
        }
      }
    }
    return classPath;
  }

  private String extractMainClassFromOutput(BufferedReader bufferedReader, String javaFile)
      throws IOException {
    String line;
    String mainClass = null;
    while ((line = bufferedReader.readLine()) != null) {
      System.out.println("Line: " + line); // added debug message
      if (line.contains(javaFile)) {
        mainClass = line.trim();
        break;
      }
    }
    return mainClass;
  }

  private void runJavaWithClassPath(String classPath, String mainClass) {
    try {
      ProcessBuilder pb = new ProcessBuilder("java", "-classpath", classPath, mainClass);
      pb.inheritIO();
      pb.start().waitFor();
    } catch (IOException | InterruptedException e) {
      e.printStackTrace();
    }
  }
}
