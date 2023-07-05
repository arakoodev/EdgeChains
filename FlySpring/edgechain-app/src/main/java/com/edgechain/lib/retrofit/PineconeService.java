package com.edgechain.lib.retrofit;

import com.edgechain.lib.embeddings.WordEmbeddings;
import com.edgechain.lib.index.request.feign.PineconeRequest;
import com.edgechain.lib.response.StringResponse;
import io.reactivex.rxjava3.core.Single;
import retrofit2.http.Body;
import retrofit2.http.HTTP;
import retrofit2.http.POST;

import java.util.List;

public interface PineconeService {

  @POST(value = "index/pinecone/upsert")
  Single<StringResponse> upsert(@Body PineconeRequest request);

  @POST(value = "index/pinecone/query")
  Single<List<WordEmbeddings>> query(@Body PineconeRequest request);

  @HTTP(method = "DELETE", path = "index/pinecone/deleteAll", hasBody = true)
  Single<StringResponse> deleteAll(@Body PineconeRequest request);
}
