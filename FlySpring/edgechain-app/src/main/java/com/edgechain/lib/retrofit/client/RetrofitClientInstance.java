package com.edgechain.lib.retrofit.client;

import com.edgechain.lib.configuration.WebConfiguration;
import com.edgechain.lib.configuration.context.ApplicationContextHolder;
import com.edgechain.lib.configuration.domain.SecurityUUID;
import com.edgechain.lib.retrofit.utils.PageJacksonModule;
import com.edgechain.lib.retrofit.utils.SortJacksonModule;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jdk8.Jdk8Module;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.fasterxml.jackson.module.paramnames.ParameterNamesModule;
import com.google.gson.Gson;
import com.google.gson.reflect.TypeToken;
import java.io.IOException;
import java.lang.reflect.Type;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.TimeUnit;
import okhttp3.ConnectionPool;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.ResponseBody;
import retrofit2.Retrofit;
import retrofit2.adapter.rxjava3.RxJava3CallAdapterFactory;
import retrofit2.converter.jackson.JacksonConverterFactory;

public class RetrofitClientInstance {

  private RetrofitClientInstance() {
    // no
  }

  private static final String BASE_URL = "http://0.0.0.0";

  private static SecurityUUID securityUUID;
  private static Retrofit retrofit;

  public static Retrofit getInstance() {
    if (retrofit == null) {

      // tests may set this to a mock - do not overwrite it if present.
      if (securityUUID == null) {
        securityUUID = ApplicationContextHolder.getContext().getBean(SecurityUUID.class);
      }

      return retrofit =
          new Retrofit.Builder()
              .baseUrl(
                  BASE_URL
                      + ":"
                      + System.getProperty("server.port")
                      + WebConfiguration.CONTEXT_PATH
                      + "/")
              .addConverterFactory(createJacksonFactory())
              .addCallAdapterFactory(RxJava3CallAdapterFactory.create())
              .client(
                  new OkHttpClient.Builder()
                      .connectionPool(new ConnectionPool(10, 5, TimeUnit.MINUTES))
                      .addInterceptor(
                          chain -> {
                            try {
                              Request original = chain.request();
                              final String authKey = securityUUID.getAuthKey();
                              Request request =
                                  original.newBuilder().header("Authorization", authKey).build();
                              Response response = chain.proceed(request);
                              String body = response.body().string();

                              String errorMessage = "";

                              if (!response.isSuccessful()) {
                                // Create a new Gson object
                                Gson gson = new Gson();

                                // Define the type for the map
                                Type type = new TypeToken<Map<String, String>>() {}.getType();

                                // Convert JSON string into a map
                                Map<String, String> map = gson.fromJson(body, type);

                                if (Objects.nonNull(map)) {
                                  errorMessage = map.toString();
                                }
                              }

                              return response
                                  .newBuilder()
                                  .body(ResponseBody.create(body, response.body().contentType()))
                                  .message(errorMessage)
                                  .build();
                            } catch (Exception e) {
                              // Interceptor can handle only IOException. Anything else = stall.
                              // Solution: wrap any exception in an IOException.
                              // Read more here: https://github.com/square/retrofit/issues/3453
                              throw new IOException(e);
                            }
                          })
                      .connectTimeout(15, TimeUnit.MINUTES)
                      .readTimeout(20, TimeUnit.MINUTES)
                      .build())
              .build();
    }
    return retrofit;
  }

  private static JacksonConverterFactory createJacksonFactory() {
    ObjectMapper objectMapper = new ObjectMapper();
    objectMapper.setSerializationInclusion(JsonInclude.Include.NON_NULL);
    objectMapper.registerModule(new JavaTimeModule());
    objectMapper.registerModule(new ParameterNamesModule());
    objectMapper.registerModule(new Jdk8Module());
    objectMapper.registerModule(new PageJacksonModule());
    objectMapper.registerModule(new SortJacksonModule());
    objectMapper.configure(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS, false);
    return JacksonConverterFactory.create(objectMapper);
  }
}
