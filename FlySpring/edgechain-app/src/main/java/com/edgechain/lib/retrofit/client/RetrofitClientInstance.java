package com.edgechain.lib.retrofit.client;

import okhttp3.OkHttpClient;
import retrofit2.Retrofit;
import retrofit2.adapter.rxjava3.RxJava3CallAdapterFactory;
import retrofit2.converter.jackson.JacksonConverterFactory;

import java.util.concurrent.TimeUnit;

public class RetrofitClientInstance {

  private static final String BASE_URL = "http://0.0.0.0";

  private static Retrofit retrofit;

  public static Retrofit getInstance() {
    if (retrofit == null) {
      return retrofit =
          new Retrofit.Builder()
              .baseUrl(BASE_URL + ":" + System.getProperty("server.port") + "/v2/")
              .addConverterFactory(JacksonConverterFactory.create())
              .addCallAdapterFactory(RxJava3CallAdapterFactory.create())
              .client(
                  new OkHttpClient.Builder()
                      .connectTimeout(15, TimeUnit.MINUTES)
                      .readTimeout(15, TimeUnit.MINUTES)
                      //                            .addInterceptor(chain -> {
                      //                                Request request = chain.request();
                      ////                    logger.info("Sending request to url: {}",
                      // request.url());
                      //                                Response response = chain.proceed(request);
                      ////                    logger.info("Received response for call: {}",
                      // request.url());
                      //                                return response;
                      //                            })
                      .build())
              .build();
    }
    return retrofit;
  }
}
