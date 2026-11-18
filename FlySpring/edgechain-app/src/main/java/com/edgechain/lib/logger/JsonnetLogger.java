package com.edgechain.lib.logger;

import com.edgechain.lib.logger.entities.JsonnetLog;
import com.edgechain.lib.retrofit.client.RetrofitClientInstance;
import java.util.HashMap;

import com.edgechain.lib.retrofit.logger.JsonnetLoggerService;
import org.springframework.data.domain.Page;
import retrofit2.Retrofit;

public class JsonnetLogger {

  private final Retrofit retrofit = RetrofitClientInstance.getInstance();
  private final JsonnetLoggerService jsonnetLoggerService =
      retrofit.create(JsonnetLoggerService.class);

  public JsonnetLogger() {}

  public Page<JsonnetLog> findAll(int page, int size) {
    return this.jsonnetLoggerService.findAll(page, size).blockingGet();
  }

  public Page<JsonnetLog> findAllOrderByCreatedAtDesc(int page, int size) {
    return this.jsonnetLoggerService.findAllOrderByCreatedAtDesc(page, size).blockingGet();
  }

  public Page<JsonnetLog> findAllBySelectedFileOrderByCreatedAtDesc(
      String filename, int page, int size) {

    HashMap<String, String> mapper = new HashMap<>();
    mapper.put("filename", filename);

    return this.jsonnetLoggerService
        .findAllBySelectedFileOrderByCreatedAtDesc(mapper, page, size)
        .blockingGet();
  }
}
