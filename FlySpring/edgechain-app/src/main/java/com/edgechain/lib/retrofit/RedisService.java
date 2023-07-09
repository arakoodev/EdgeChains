package com.edgechain.lib.retrofit;

import com.edgechain.lib.embeddings.WordEmbeddings;
import com.edgechain.lib.index.request.feign.RedisRequest;
import com.edgechain.lib.response.StringResponse;
import io.reactivex.rxjava3.core.Completable;
import io.reactivex.rxjava3.core.Single;
import retrofit2.http.Body;
import retrofit2.http.HTTP;
import retrofit2.http.POST;
import retrofit2.http.Query;

import java.util.List;

public interface RedisService {

  @POST(value = "index/redis/upsert")
  Single<StringResponse> upsert(@Body RedisRequest request);

  @POST(value = "index/redis/query")
  Single<List<WordEmbeddings>> query(@Body RedisRequest request);

  @HTTP(method = "DELETE", path = "index/redis/delete", hasBody = true)
  Completable deleteByPattern(@Query("pattern") String pattern, @Body RedisRequest request);
}
