package com.flyspring.flyfly.utils;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;

import org.springframework.stereotype.Component;

import lombok.extern.slf4j.Slf4j;
import net.lingala.zip4j.ZipFile;

@Component
@Slf4j
public class FileTools {
  public void exportFileTo(String file, String dest) throws IOException {
    log.debug("Exporting " + file + " To " + dest);
    InputStream resource = FileTools.class.getClassLoader().getResourceAsStream(file);
    Files.copy(resource, Path.of(dest));
    log.debug("Exported successfully");
  }

  public void unzip(String zipFilePath, String destDir) throws IOException {
    log.debug("Unzipping " + zipFilePath + " into " + destDir);
    ZipFile zipFile = new ZipFile(zipFilePath);
    zipFile.extractAll(destDir);
    zipFile.close();
    log.debug("Unzipped successfully");
  }
}
