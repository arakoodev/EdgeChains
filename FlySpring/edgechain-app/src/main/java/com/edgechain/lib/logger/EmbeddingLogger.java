package com.edgechain.lib.logger;

import com.edgechain.lib.logger.entities.EmbeddingLog;
import com.edgechain.lib.retrofit.client.RetrofitClientInstance;
import com.edgechain.lib.retrofit.logger.EmbeddingLoggerService;
import java.util.HashMap;
import org.springframework.data.domain.Page;
import org.springframework.web.bind.annotation.PathVariable;
import retrofit2.Retrofit;

public class EmbeddingLogger {

  private final Retrofit retrofit = RetrofitClientInstance.getInstance();
  private final EmbeddingLoggerService embeddingLoggerService =
      retrofit.create(EmbeddingLoggerService.class);

  public EmbeddingLogger() {}

  public Page<EmbeddingLog> findAll(int page, int size) {
    return this.embeddingLoggerService.findAll(page, size).blockingGet();
  }

  public Page<EmbeddingLog> findAllOrderByCompletedAtDesc(int page, int size) {
    return this.embeddingLoggerService.findAllOrderByCompletedAtDesc(page, size).blockingGet();
  }

  public Page<EmbeddingLog> findAllByModel(String model, int page, int size) {
    HashMap<String, String> mapper = new HashMap<>();
    mapper.put("model", model);
    return this.embeddingLoggerService.findAllByModel(mapper, page, size).blockingGet();
  }

  public Page<EmbeddingLog> findAllByModelOrderByCompletedAtDesc(String model, int page, int size) {

    HashMap<String, String> mapper = new HashMap<>();
    mapper.put("model", model);

    return this.embeddingLoggerService
        .findAllByModelOrderByCompletedAtDesc(mapper, page, size)
        .blockingGet();
  }

  public Page<EmbeddingLog> findAllByCallIdentifier(
      String callIdentifier, @PathVariable int page, @PathVariable int size) {

    HashMap<String, String> mapper = new HashMap<>();
    mapper.put("identifier", callIdentifier);

    return this.embeddingLoggerService.findAllByCallIdentifier(mapper, page, size).blockingGet();
  }

  public Page<EmbeddingLog> findAllByCallIdentifierOrderByCompletedAtDesc(
      String callIdentifier, @PathVariable int page, @PathVariable int size) {

    HashMap<String, String> mapper = new HashMap<>();
    mapper.put("identifier", callIdentifier);

    return this.embeddingLoggerService
        .findAllByCallIdentifierOrderByCompletedAtDesc(mapper, page, size)
        .blockingGet();
  }

  public Page<EmbeddingLog> findAllByLatencyLessThanEqual(
      long latency, @PathVariable int page, @PathVariable int size) {

    HashMap<String, Long> mapper = new HashMap<>();
    mapper.put("latency", latency);

    return this.embeddingLoggerService
        .findAllByLatencyLessThanEqual(mapper, page, size)
        .blockingGet();
  }

  public Page<EmbeddingLog> findAllByLatencyGreaterThanEqual(
      long latency, @PathVariable int page, @PathVariable int size) {

    HashMap<String, Long> mapper = new HashMap<>();
    mapper.put("latency", latency);
    return this.embeddingLoggerService
        .findAllByLatencyGreaterThanEqual(mapper, page, size)
        .blockingGet();
  }
}
