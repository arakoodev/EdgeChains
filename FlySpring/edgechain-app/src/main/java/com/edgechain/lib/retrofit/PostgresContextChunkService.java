package com.edgechain.lib.retrofit;

import com.edgechain.lib.endpoint.impl.PostgresEndpoint;
import com.edgechain.lib.index.domain.PostgresWordEmbeddings;
import com.edgechain.lib.response.StringResponse;
import io.reactivex.rxjava3.core.Single;
import retrofit2.http.Body;
import retrofit2.http.HTTP;
import retrofit2.http.POST;

import java.util.List;

public interface PostgresContextChunkService {
  @POST(value = "index/postgres/upsert-embeddings")
  Single<StringResponse> upsertEmbeddings(@Body PostgresEndpoint postgresEndpoint);

  @POST(value = "index/postgres/query-embeddings")
  Single<List<PostgresWordEmbeddings>> query(@Body PostgresEndpoint postgresEndpoint);
}
