package com.edgechain.lib.retrofit;

import com.edgechain.lib.embeddings.request.Doc2VecRequest;
import com.edgechain.lib.response.StringResponse;
import io.reactivex.rxjava3.core.Single;
import retrofit2.http.Body;
import retrofit2.http.POST;

public interface Doc2VecService {

  @POST(value = "doc2vec")
  Single<StringResponse> build(@Body Doc2VecRequest doc2VecRequest);
}
