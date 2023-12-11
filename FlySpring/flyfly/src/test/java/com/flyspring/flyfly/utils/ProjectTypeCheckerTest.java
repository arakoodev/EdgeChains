package com.flyspring.flyfly.utils;

import org.junit.jupiter.api.*;

import java.io.IOException;
import java.nio.file.*;

import static org.junit.jupiter.api.Assertions.*;

class ProjectTypeCheckerTest {

    private ProjectTypeChecker projectTypeChecker;

    @BeforeEach
    void setUp() {
        projectTypeChecker = new ProjectTypeChecker();
    }

    @Test
    @DisplayName("Test whether the directory is not a Maven project")
    void testIsNotMavenProject() throws IOException {
        // Create a temporary directory and file
        Path tempDirectory = Files.createTempDirectory("tempDir");
        Path tempFile = Files.createTempFile(tempDirectory, "test", ".txt");

        // Check that the file is not named "pom.xml"
        assertFalse(tempFile.toFile().getName().equals("pom.xml"));

        // Move to the temporary directory and check if it is a Maven project
        System.setProperty("user.dir", tempDirectory.toString());
        assertFalse(projectTypeChecker.isMavenProject());

        // Delete the temporary directory and file
        Files.deleteIfExists(tempFile);
        Files.deleteIfExists(tempDirectory);
    }

    @Test
    @DisplayName("Test whether the directory is not a Gradle project")
    void testIsNotGradleProject() throws IOException {
        // Create a temporary directory and file
        Path tempDirectory = Files.createTempDirectory("tempDir");
        Path tempFile = Files.createTempFile(tempDirectory, "test", ".txt");

        // Check that the file is not named "build.gradle"
        assertFalse(tempFile.toFile().getName().equals("build.gradle"));

        // Move to the temporary directory and check if it is a Gradle project
        System.setProperty("user.dir", tempDirectory.toString());
        assertFalse(projectTypeChecker.isGradleProject());

        // Delete the temporary directory and file
        Files.deleteIfExists(tempFile);
        Files.deleteIfExists(tempDirectory);
    }
}
