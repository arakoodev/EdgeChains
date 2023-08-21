package com.edgechain.lib.logger;

import com.edgechain.lib.logger.entities.ChatCompletionLog;
import com.edgechain.lib.retrofit.client.RetrofitClientInstance;
import com.edgechain.lib.retrofit.logger.ChatCompletionLoggerService;
import org.springframework.data.domain.Page;
import org.springframework.web.bind.annotation.PathVariable;
import retrofit2.Retrofit;

import java.util.HashMap;

public class ChatCompletionLogger {

  private final Retrofit retrofit = RetrofitClientInstance.getInstance();
  private final ChatCompletionLoggerService chatCompletionLoggerService =
      retrofit.create(ChatCompletionLoggerService.class);

  public ChatCompletionLogger() {}

  public Page<ChatCompletionLog> findAll(int page, int size) {
    return this.chatCompletionLoggerService.findAll(page, size).blockingGet();
  }

  public Page<ChatCompletionLog> findAllOrderByCompletedAtDesc(int page, int size) {
    return this.chatCompletionLoggerService.findAllOrderByCompletedAtDesc(page, size).blockingGet();
  }

  public Page<ChatCompletionLog> findAllByName(String name, int page, int size) {

    HashMap<String, String> mapper = new HashMap<>();
    mapper.put("name", name);

    return this.chatCompletionLoggerService.findAllByName(mapper, page, size).blockingGet();
  }

  public Page<ChatCompletionLog> findAllByNameOrderByCompletedAtDesc(
      String name, int page, int size) {

    HashMap<String, String> mapper = new HashMap<>();
    mapper.put("name", name);

    return this.chatCompletionLoggerService
        .findAllByNameOrderByCompletedAtDesc(mapper, page, size)
        .blockingGet();
  }

  public Page<ChatCompletionLog> findAllByModel(String model, int page, int size) {
    HashMap<String, String> mapper = new HashMap<>();
    mapper.put("model", model);
    return this.chatCompletionLoggerService.findAllByModel(mapper, page, size).blockingGet();
  }

  public Page<ChatCompletionLog> findAllByModelOrderByCompletedAtDesc(
      String model, int page, int size) {

    HashMap<String, String> mapper = new HashMap<>();
    mapper.put("model", model);

    return this.chatCompletionLoggerService
        .findAllByModelOrderByCompletedAtDesc(mapper, page, size)
        .blockingGet();
  }

  public Page<ChatCompletionLog> findAllByCallIdentifier(
      String callIdentifier, @PathVariable int page, @PathVariable int size) {

    HashMap<String, String> mapper = new HashMap<>();
    mapper.put("identifier", callIdentifier);

    return this.chatCompletionLoggerService
        .findAllByCallIdentifier(mapper, page, size)
        .blockingGet();
  }

  public Page<ChatCompletionLog> findAllByCallIdentifierOrderByCompletedAtDesc(
      String callIdentifier, @PathVariable int page, @PathVariable int size) {

    HashMap<String, String> mapper = new HashMap<>();
    mapper.put("identifier", callIdentifier);

    return this.chatCompletionLoggerService
        .findAllByCallIdentifierOrderByCompletedAtDesc(mapper, page, size)
        .blockingGet();
  }

  public Page<ChatCompletionLog> findAllByLatencyLessThanEqual(
      long latency, @PathVariable int page, @PathVariable int size) {

    HashMap<String, Long> mapper = new HashMap<>();
    mapper.put("latency", latency);

    return this.chatCompletionLoggerService
        .findAllByLatencyLessThanEqual(mapper, page, size)
        .blockingGet();
  }

  public Page<ChatCompletionLog> findAllByLatencyGreaterThanEqual(
      long latency, @PathVariable int page, @PathVariable int size) {

    HashMap<String, Long> mapper = new HashMap<>();
    mapper.put("latency", latency);
    return this.chatCompletionLoggerService
        .findAllByLatencyGreaterThanEqual(mapper, page, size)
        .blockingGet();
  }
}
