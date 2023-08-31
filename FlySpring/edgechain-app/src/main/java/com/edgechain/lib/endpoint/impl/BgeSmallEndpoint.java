package com.edgechain.lib.endpoint.impl;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.URL;
import java.nio.channels.Channels;
import java.nio.channels.ReadableByteChannel;
import java.util.Objects;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import com.edgechain.lib.embeddings.WordEmbeddings;
import com.edgechain.lib.endpoint.Endpoint;
import com.edgechain.lib.request.ArkRequest;
import com.edgechain.lib.retrofit.BgeSmallService;
import com.edgechain.lib.retrofit.client.RetrofitClientInstance;
import com.edgechain.lib.rxjava.retry.RetryPolicy;

public class BgeSmallEndpoint extends Endpoint {

  private static final Logger logger = LoggerFactory.getLogger(BgeSmallEndpoint.class);

  private final BgeSmallService bgeSmallService =
      RetrofitClientInstance.getInstance().create(BgeSmallService.class);

  private String input;

  private String modelUrl;
  private String tokenizerUrl;

  private String callIdentifier;

  static final String MODEL_FOLDER = "./model";
  static final String MODEL_PATH = MODEL_FOLDER + "/model.onnx";
  static final String TOKENIZER_PATH = MODEL_FOLDER + "/tokenizer.json";

  public BgeSmallEndpoint() {}

  public BgeSmallEndpoint(String modelUrl, String tokenizerUrl) {
    this.modelUrl = modelUrl;
    this.tokenizerUrl = tokenizerUrl;

    File modelFile = new File(MODEL_PATH);
    if (!modelFile.exists()) {
      logger.info("Downloading bge-small-en model from {} to {}. Please wait...", modelUrl,
          modelFile.getAbsolutePath());
      downloadFile(modelUrl, MODEL_PATH);
    }

    File tokenizerFile = new File(TOKENIZER_PATH);
    if (!tokenizerFile.exists()) {
      logger.info("Downloading bge-small-en tokenizer from {} to {}. Please wait...", tokenizerUrl,
          tokenizerFile.getAbsolutePath());
      downloadFile(tokenizerUrl, TOKENIZER_PATH);
    }

    logger.info("Model bge-small-en present!");
  }

  public String getModelUrl() {
    return modelUrl;
  }

  public String getTokenizerUrl() {
    return tokenizerUrl;
  }

  public String getInput() {
    return input;
  }

  public String getCallIdentifier() {
    return callIdentifier;
  }

  public BgeSmallEndpoint(RetryPolicy retryPolicy, String modelUrl, String tokenizerUrl) {
    super(retryPolicy);
    this.modelUrl = modelUrl;
    this.tokenizerUrl = tokenizerUrl;
  }

  public WordEmbeddings embeddings(String input, ArkRequest arkRequest) {

    this.input = input; // set Input

    if (Objects.nonNull(arkRequest)) {
      this.callIdentifier = arkRequest.getRequestURI();
    }

    return bgeSmallService.embeddings(this).map(m -> new WordEmbeddings(input, m.getEmbedding()))
        .blockingGet();
  }

  private void downloadFile(String urlStr, String path) {

    File modelFolderFile = new File(MODEL_FOLDER);

    if (!modelFolderFile.exists()) {
      logger.info("Creating directory {}", MODEL_FOLDER);
      modelFolderFile.mkdir();
    }

    try {
      URL url = new URL(urlStr);
      try (InputStream is = url.openStream();
          ReadableByteChannel rbc = Channels.newChannel(is);
          FileOutputStream fos = new FileOutputStream(path)) {
        long transferred = fos.getChannel().transferFrom(rbc, 0, Long.MAX_VALUE);
        logger.info("Downloaded {} bytes", transferred);
      }
    } catch (IOException e) {
      logger.error("Error downloading model", e);
    }
  }
}
