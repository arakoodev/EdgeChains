package com.edgechain.lib.jsonnet.impl;

import com.edgechain.lib.jsonnet.JsonnetLoader;
import com.edgechain.lib.jsonnet.exceptions.JsonnetLoaderException;

import java.io.*;

public class FileJsonnetLoader extends JsonnetLoader {

  private String filePath;

  public FileJsonnetLoader(String filePath) {
    this.filePath = filePath;
  }

  public FileJsonnetLoader() {
    super();
  }

  @Override
  public JsonnetLoader loadOrReload() {
    try (InputStream in = new FileInputStream(filePath)) {
      this.load(in);
      return this;
    } catch (final Exception e) {
      throw new JsonnetLoaderException(e.getMessage());
    }
  }

  public String getFilePath() {
    return filePath;
  }
}
