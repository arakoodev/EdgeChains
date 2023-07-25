package com.edgechain.lib.retrofit.client;

import com.edgechain.lib.configuration.context.ApplicationContextHolder;
import com.edgechain.lib.configuration.domain.SecurityUUID;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jdk8.Jdk8Module;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.fasterxml.jackson.module.paramnames.ParameterNamesModule;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import retrofit2.Retrofit;
import retrofit2.adapter.rxjava3.RxJava3CallAdapterFactory;
import retrofit2.converter.jackson.JacksonConverterFactory;

import java.util.concurrent.TimeUnit;

public class RetrofitClientInstance {

  private static final String BASE_URL = "http://0.0.0.0";

  private static SecurityUUID securityUUID =
      ApplicationContextHolder.getContext().getBean(SecurityUUID.class);

  private static Retrofit retrofit;

  public static Retrofit getInstance() {
    if (retrofit == null) {
      return retrofit =
          new Retrofit.Builder()
              .baseUrl(BASE_URL + ":" + System.getProperty("server.port") + "/v2/")
              .addConverterFactory(JacksonBuilder())
              .addCallAdapterFactory(RxJava3CallAdapterFactory.create())
              .client(
                  new OkHttpClient.Builder()
                      .addInterceptor(
                          chain -> {
                            Request original = chain.request();
                            Request request =
                                original
                                    .newBuilder()
                                    .header("Authorization", securityUUID.getAuthKey())
                                    .build();

                            return chain.proceed(request);
                          })
                      .connectTimeout(15, TimeUnit.MINUTES)
                      .readTimeout(15, TimeUnit.MINUTES)
                      .build())
              .build();
    }
    return retrofit;
  }

  private static JacksonConverterFactory JacksonBuilder() {
    ObjectMapper objectMapper = new ObjectMapper();
    objectMapper.setSerializationInclusion(JsonInclude.Include.NON_NULL);
    objectMapper.registerModule(new JavaTimeModule());
    objectMapper.registerModule(new ParameterNamesModule());
    objectMapper.registerModule(new Jdk8Module());
    objectMapper.configure(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS, false);
    return JacksonConverterFactory.create(objectMapper);
  }
}
