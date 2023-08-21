package com.edgechain.lib.reader;

import com.edgechain.lib.chunk.enums.LangType;

import java.io.InputStream;
import java.io.Serializable;

public abstract class Reader implements Serializable {

  private static final long serialVersionUID = 5990895695593800211L;

  public Reader() {}

  public abstract String[] readByChunkSize(InputStream inputStream, int chunkSize);

  public abstract String[] readBySentence(LangType langType, InputStream fileInputStream);

  public abstract String[] readBySentence(
      InputStream modelInputStream, InputStream fileInputStream);
}
