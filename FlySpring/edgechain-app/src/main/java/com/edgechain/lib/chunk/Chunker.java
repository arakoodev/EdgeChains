package com.edgechain.lib.chunk;

import com.edgechain.lib.chunk.enums.LangType;
import opennlp.tools.sentdetect.SentenceDetectorME;
import opennlp.tools.sentdetect.SentenceModel;

import java.io.IOException;
import java.io.InputStream;
import java.util.Objects;
import java.util.stream.IntStream;

public class Chunker {

  private final String input;

  public Chunker(String input) {
    this.input = input;
  }

  public String[] byChunkSize(int chunkSize) {

    int noOfChunks = (int) Math.ceil((float) this.input.length() / chunkSize);

    return IntStream.range(0, noOfChunks)
        .parallel()
        .mapToObj(
            i -> {
              int start = i * chunkSize;
              int end = Math.min((i + 1) * chunkSize, this.input.length());
              return this.input.substring(start, end).strip();
            })
        .toArray(String[]::new);
  }

  public String[] bySentence(LangType langType) {
    SentenceModel model = null;
    try {

      if (langType.equals(LangType.EN))
        model =
            new SentenceModel(
                Objects.requireNonNull(getClass().getResourceAsStream("/en-sent.zip")));
      else if (langType.equals(LangType.FR))
        model =
            new SentenceModel(
                Objects.requireNonNull(getClass().getResourceAsStream("/fr-sent.zip")));
      else if (langType.equals(LangType.DE))
        model =
            new SentenceModel(
                Objects.requireNonNull(getClass().getResourceAsStream("/de-sent.zip")));
      else if (langType.equals(LangType.IT))
        model =
            new SentenceModel(
                Objects.requireNonNull(getClass().getResourceAsStream("/it-sent.zip")));
      else
        model =
            new SentenceModel(
                Objects.requireNonNull(getClass().getResourceAsStream("/nl-sent.zip")));

    } catch (IOException e) {
      throw new RuntimeException(e);
    }
    SentenceDetectorME sdetector = new SentenceDetectorME(model);

    // detect sentences in the paragraph
    return sdetector.sentDetect(this.input);
  }

  public String[] bySentence(InputStream inputStream) {

    SentenceModel model = null;
    try {
      model = new SentenceModel(inputStream);
    } catch (IOException e) {
      throw new RuntimeException(e);
    }
    SentenceDetectorME sdetector = new SentenceDetectorME(model);

    // detect sentences in the paragraph
    return sdetector.sentDetect(this.input);
  }
}
