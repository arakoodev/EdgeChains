package com.edgechain.lib.retrofit;

import com.edgechain.lib.endpoint.impl.PostgresEndpoint;
import com.edgechain.lib.index.domain.PostgresWordEmbeddings;
import com.edgechain.lib.response.StringResponse;
import io.reactivex.rxjava3.core.Single;
import java.util.List;

import retrofit2.http.Body;
import retrofit2.http.HTTP;
import retrofit2.http.POST;

public interface PostgresService {

  @POST(value = "index/postgres/upsert")
  Single<StringResponse> upsert(@Body PostgresEndpoint postgresEndpoint);

  //
  @POST(value = "index/postgres/query")
  Single<List<PostgresWordEmbeddings>> query(@Body PostgresEndpoint postgresEndpoint);

  @POST("index/postgres/probes")
  Single<StringResponse> probes(@Body PostgresEndpoint postgresEndpoint);

  @HTTP(method = "DELETE", path = "index/postgres/deleteAll", hasBody = true)
  Single<StringResponse> deleteAll(@Body PostgresEndpoint postgresEndpoint);
}
