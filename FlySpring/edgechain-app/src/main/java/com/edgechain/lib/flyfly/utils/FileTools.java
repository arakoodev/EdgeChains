package com.edgechain.lib.flyfly.utils;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import net.lingala.zip4j.ZipFile;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

@Component
public class FileTools {

  private final Logger log = LoggerFactory.getLogger(this.getClass());

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
