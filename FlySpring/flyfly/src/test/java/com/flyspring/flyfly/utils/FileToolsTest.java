package com.flyspring.flyfly.utils;

import static org.junit.jupiter.api.Assertions.*;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class FileToolsTest {

  private FileTools fileTools;

  @BeforeEach
  void setUp() {
    fileTools = new FileTools();
  }

  @Test
  void testUnzip() throws IOException {
    // Create a zip file with two entries
    Path tempDir = Files.createTempDirectory("test");
    File zipFile = new File(tempDir.toFile(), "test.zip");
    FileOutputStream fos = new FileOutputStream(zipFile);
    ZipOutputStream zos = new ZipOutputStream(fos);
    zos.putNextEntry(new ZipEntry("test1.txt"));
    zos.write("test1".getBytes());
    zos.closeEntry();
    zos.putNextEntry(new ZipEntry("test2.txt"));
    zos.write("test2".getBytes());
    zos.closeEntry();
    zos.close();

    // Unzip the zip file to a destination directory
    Path destDir = Files.createTempDirectory("test");
    fileTools.unzip(zipFile.getPath(), destDir.toString());

    // Verify that the two entries were unzipped correctly
    Path file1 = destDir.resolve("test1.txt");
    assertTrue(file1.toFile().exists());
    assertEquals("test1", Files.readString(file1));
    Path file2 = destDir.resolve("test2.txt");
    assertTrue(file2.toFile().exists());
    assertEquals("test2", Files.readString(file2));

    // Clean up the temporary directories and files
    Files.deleteIfExists(file1);
    Files.deleteIfExists(file2);
    Files.deleteIfExists(destDir);
    Files.deleteIfExists(zipFile.toPath());
    Files.deleteIfExists(tempDir);
  }
}
