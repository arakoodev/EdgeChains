package com.edgechain.lib.retrofit;

import com.edgechain.lib.embeddings.WordEmbeddings;
import com.edgechain.lib.endpoint.impl.PostgresEndpoint;
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
  Single<List<WordEmbeddings>> query(@Body PostgresEndpoint postgresEndpoint);

  @HTTP(method = "DELETE", path = "index/postgres/deleteAll", hasBody = true)
  Single<StringResponse> deleteAll(@Body PostgresEndpoint postgresEndpoint);
}
