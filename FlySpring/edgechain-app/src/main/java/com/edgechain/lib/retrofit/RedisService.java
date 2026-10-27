package com.edgechain.lib.retrofit;

import com.edgechain.lib.embeddings.WordEmbeddings;
import com.edgechain.lib.endpoint.impl.index.RedisEndpoint;
import com.edgechain.lib.response.StringResponse;
import io.reactivex.rxjava3.core.Completable;
import io.reactivex.rxjava3.core.Single;
import retrofit2.http.Body;
import retrofit2.http.HTTP;
import retrofit2.http.POST;

import java.util.List;

public interface RedisService {

  @POST(value = "index/redis/create-index")
  Single<StringResponse> createIndex(@Body RedisEndpoint redisEndpoint);

  @POST(value = "index/redis/upsert")
  Single<StringResponse> upsert(@Body RedisEndpoint redisEndpoint);

  @POST(value = "index/redis/batch-upsert")
  Single<StringResponse> batchUpsert(@Body RedisEndpoint redisEndpoint);

  @POST(value = "index/redis/query")
  Single<List<WordEmbeddings>> query(@Body RedisEndpoint redisEndpoint);

  @HTTP(method = "DELETE", path = "index/redis/delete", hasBody = true)
  Completable deleteByPattern(@Body RedisEndpoint redisEndpoint);
}
