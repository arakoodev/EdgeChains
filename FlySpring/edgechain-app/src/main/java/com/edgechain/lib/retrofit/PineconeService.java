package com.edgechain.lib.retrofit;

import com.edgechain.lib.embeddings.WordEmbeddings;
import com.edgechain.lib.endpoint.impl.index.PineconeEndpoint;
import com.edgechain.lib.response.StringResponse;
import io.reactivex.rxjava3.core.Single;
import retrofit2.http.Body;
import retrofit2.http.HTTP;
import retrofit2.http.POST;

import java.util.List;

public interface PineconeService {

  @POST(value = "index/pinecone/upsert")
  Single<StringResponse> upsert(@Body PineconeEndpoint pineconeEndpoint);

  @POST(value = "index/pinecone/batch-upsert")
  Single<StringResponse> batchUpsert(@Body PineconeEndpoint pineconeEndpoint);

  @POST(value = "index/pinecone/query")
  Single<List<WordEmbeddings>> query(@Body PineconeEndpoint pineconeEndpoint);

  @HTTP(method = "DELETE", path = "index/pinecone/deleteAll", hasBody = true)
  Single<StringResponse> deleteAll(@Body PineconeEndpoint pineconeEndpoint);
}
