package com.flyspring.flyfly.utils;

import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

public class ProjectTypeCheckerTest {

  private ProjectTypeChecker projectTypeChecker;

  @BeforeEach
  public void setup() {
    projectTypeChecker = new ProjectTypeChecker();
  }

  @Test
  public void testIsMavenProject() throws IOException {
    // Create a temporary directory and file
    Path tempDirectory = Files.createTempDirectory("tempDir");
    Path tempFile = Files.createTempFile(tempDirectory, "test", ".txt");

    // Check that the file is not named "pom.xml"
    Assertions.assertFalse(tempFile.toFile().getName().equals("pom.xml"));

    // Move to the temporary directory and check if it is a Maven project
    System.setProperty("user.dir", tempDirectory.toString());
    Assertions.assertFalse(projectTypeChecker.isMavenProject());

    // Delete the temporary directory and file
    Files.deleteIfExists(tempFile);
    Files.deleteIfExists(tempDirectory);
  }

  @Test
  public void testIsGradleProject() throws IOException {
    // Create a temporary directory and file
    Path tempDirectory = Files.createTempDirectory("tempDir");
    Path tempFile = Files.createTempFile(tempDirectory, "test", ".txt");

    // Check that the file is not named "build.gradle"
    Assertions.assertFalse(tempFile.toFile().getName().equals("build.gradle"));

    // Move to the temporary directory and check if it is a Gradle project
    System.setProperty("user.dir", tempDirectory.toString());
    Assertions.assertFalse(projectTypeChecker.isGradleProject());

    // Delete the temporary directory and file
    Files.deleteIfExists(tempFile);
    Files.deleteIfExists(tempDirectory);
  }
}
