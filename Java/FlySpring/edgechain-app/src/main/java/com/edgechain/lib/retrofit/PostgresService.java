package com.edgechain.lib.retrofit;

import com.edgechain.lib.endpoint.impl.index.PostgresEndpoint;
import com.edgechain.lib.index.domain.PostgresWordEmbeddings;
import com.edgechain.lib.response.StringResponse;
import io.reactivex.rxjava3.core.Single;
import java.util.List;

import retrofit2.http.Body;
import retrofit2.http.HTTP;
import retrofit2.http.POST;

public interface PostgresService {

  @POST(value = "index/postgres/create-table")
  Single<StringResponse> createTable(@Body PostgresEndpoint postgresEndpoint);

  @POST(value = "index/postgres/metadata/create-table")
  Single<StringResponse> createMetadataTable(@Body PostgresEndpoint postgresEndpoint);

  @POST(value = "index/postgres/upsert")
  Single<StringResponse> upsert(@Body PostgresEndpoint postgresEndpoint);

  @POST(value = "index/postgres/batch-upsert")
  Single<List<StringResponse>> batchUpsert(@Body PostgresEndpoint postgresEndpoint);

  @POST(value = "index/postgres/metadata/insert")
  Single<StringResponse> insertMetadata(@Body PostgresEndpoint postgresEndpoint);

  @POST(value = "index/postgres/metadata/batch-insert")
  Single<List<StringResponse>> batchInsertMetadata(@Body PostgresEndpoint postgresEndpoint);

  @POST(value = "index/postgres/join/insert")
  Single<StringResponse> insertIntoJoinTable(@Body PostgresEndpoint postgresEndpoint);

  @POST(value = "index/postgres/join/batch-insert")
  Single<StringResponse> batchInsertIntoJoinTable(@Body PostgresEndpoint postgresEndpoint);

  @POST(value = "index/postgres/query")
  Single<List<PostgresWordEmbeddings>> query(@Body PostgresEndpoint postgresEndpoint);

  @POST(value = "index/postgres/query-rrf")
  Single<List<PostgresWordEmbeddings>> queryRRF(@Body PostgresEndpoint postgresEndpoint);

  @POST(value = "index/postgres/metadata/query")
  Single<List<PostgresWordEmbeddings>> queryWithMetadata(@Body PostgresEndpoint postgresEndpoint);

  @POST(value = "index/postgres/chunks")
  Single<List<PostgresWordEmbeddings>> getAllChunks(@Body PostgresEndpoint postgresEndpoint);

  @POST(value = "index/postgres/similarity-metadata")
  Single<List<PostgresWordEmbeddings>> getSimilarMetadataChunk(
      @Body PostgresEndpoint postgresEndpoint);

  @POST("index/postgres/probes")
  Single<StringResponse> probes(@Body PostgresEndpoint postgresEndpoint);

  @HTTP(method = "DELETE", path = "index/postgres/deleteAll", hasBody = true)
  Single<StringResponse> deleteAll(@Body PostgresEndpoint postgresEndpoint);
}
