package com.edgechain.lib.jsonnet.impl;

import com.edgechain.lib.jsonnet.JsonnetLoader;
import com.edgechain.lib.jsonnet.exceptions.JsonnetLoaderException;
import org.apache.commons.io.FilenameUtils;

import java.io.*;

public class FileJsonnetLoader extends JsonnetLoader {

  private String filePath1;
  private String filePath2;

  public String getFilePath1() {
    return filePath1;
  }

  public void setFilePath1(String filePath1) {
    this.filePath1 = filePath1;
  }

  public String getFilePath2() {
    return filePath2;
  }

  public void setFilePath2(String filePath2) {
    this.filePath2 = filePath2;
  }

  public FileJsonnetLoader() {}

  public FileJsonnetLoader(String filePath) {
    super(filePath);
    this.filePath1 = filePath;

    if (!new File(filePath).exists()) {
      throw new JsonnetLoaderException("File not found - " + filePath);
    }
  }

  public FileJsonnetLoader(int threshold, String filePath1, String filePath2) {
    super(threshold, FilenameUtils.getName(filePath1), FilenameUtils.getName(filePath2));
    this.filePath1 = filePath1;
    this.filePath2 = filePath2;

    if (!new File(filePath1).exists()) {
      throw new JsonnetLoaderException("File not found - " + filePath1);
    }

    if (!new File(filePath2).exists()) {
      throw new JsonnetLoaderException("File not found. " + filePath2);
    }
  }

  @Override
  public JsonnetLoader loadOrReload() {

    if (getThreshold() >= 1 && getThreshold() < 100) {
      try (InputStream in1 = new FileInputStream(filePath1);
          InputStream in2 = new FileInputStream(filePath2)) {
        load(in1, in2);
        return this;
      } catch (final Exception e) {
        throw new JsonnetLoaderException(e.getMessage());
      }

    } else {
      try (InputStream in = new FileInputStream(filePath1)) {
        load(in);
        return this;
      } catch (final Exception e) {
        throw new JsonnetLoaderException(e.getMessage());
      }
    }
  }
}
