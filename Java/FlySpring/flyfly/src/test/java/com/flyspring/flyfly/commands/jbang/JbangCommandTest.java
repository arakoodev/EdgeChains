package com.flyspring.flyfly.commands.jbang;

import static org.junit.Assert.assertNull;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.BufferedReader;
import java.io.File;
import java.io.StringReader;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

public class JbangCommandTest {

  private JbangCommand jbangCommand;

  @BeforeEach
  void setUp() {
    jbangCommand = new JbangCommand();
  }

  @Test
  void testExtractFileFromResources_SuccessfulExtraction() throws Exception {
    // Test resource path
    String resourcePath = "/jbang.jar";

    // Call the method
    File extractedFile = jbangCommand.extractFileFromResources(resourcePath);

    // Assertions
    assertNotNull(extractedFile);
    assertTrue(extractedFile.exists());
    assertTrue(extractedFile.isFile());
    extractedFile.delete();
  }

  @Test
  void testExtractFileFromResources_ResourceNotFound() throws Exception {
    // Test resource path that doesn't exist
    String resourcePath = "/nonexistent-resource.txt";

    // Call the method
    File extractedFile = jbangCommand.extractFileFromResources(resourcePath);

    // Assertion
    assertNull(extractedFile);
  }

  @Test
  void testExtractFileFromResources_FileCreationAndCleanup() throws Exception {
    // Test resource path
    String resourcePath = "/jbang.jar";

    // Call the method
    File extractedFile = jbangCommand.extractFileFromResources(resourcePath);

    // Assertion
    assertNotNull(extractedFile);

    extractedFile.delete();
    assertFalse(extractedFile.exists());
  }

  @Test
  void testExtractClassPathFromOutput_NoClassPathFound() throws Exception {
    // Prepare test input
    String output = "/path/to/noClassPathFound";

    BufferedReader bufferedReader = new BufferedReader(new StringReader(output));

    // Call the method under test
    JbangCommand jbangCommand = new JbangCommand();
    String classPath = jbangCommand.extractClassPathFromOutput(bufferedReader);

    // Verify assertions
    assertNull(classPath);
  }

  @Test
  void testExtractClassPathFromOutput_EmptyOutput() throws Exception {
    // Prepare empty test input
    BufferedReader bufferedReader = new BufferedReader(new StringReader(""));

    // Call the method under test
    JbangCommand jbangCommand = new JbangCommand();
    String classPath = jbangCommand.extractClassPathFromOutput(bufferedReader);

    // Verify assertions
    assertNull(classPath);
  }
}
