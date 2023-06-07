package com.edgechain.lib.resource.impl;

import com.edgechain.lib.resource.ResourceHandler;

import java.io.File;
import java.io.FileNotFoundException;
import java.io.PrintWriter;

public class LocalFileResourceHandler extends ResourceHandler {

  private final String folder;
  private final String filename;

  public LocalFileResourceHandler(String folder, String filename) {
    this.folder = folder;
    this.filename = filename;
  }

  @Override
  public void upload(String input) {

    try {
      File directory = new File(folder);
      if (!directory.exists()) directory.mkdirs();

      PrintWriter pw = new PrintWriter(directory + File.separator + filename);
      pw.write(input);
      pw.flush();
      pw.close();
      ;
    } catch (FileNotFoundException e) {
      throw new RuntimeException(e);
    }
  }
}
