package com.edgechain.lib.endpoint.impl;

import com.edgechain.lib.embeddings.WordEmbeddings;
import com.edgechain.lib.embeddings.request.Doc2VecRequest;
import com.edgechain.lib.embeddings.services.Doc2VecInference;
import com.edgechain.lib.endpoint.Endpoint;
import com.edgechain.lib.response.StringResponse;
import com.edgechain.lib.retrofit.Doc2VecService;
import com.edgechain.lib.retrofit.client.RetrofitClientInstance;
import io.reactivex.rxjava3.core.Observable;
import org.deeplearning4j.models.paragraphvectors.ParagraphVectors;
import retrofit2.Retrofit;

public class Doc2VecEndpoint extends Endpoint {

  private ParagraphVectors paragraphVectors;

  public Doc2VecEndpoint() {}

  public Doc2VecEndpoint(ParagraphVectors paragraphVectors) {
    this.paragraphVectors = paragraphVectors;
  }

  public Observable<StringResponse> build(Doc2VecRequest doc2VecRequest) {

    Retrofit retrofit = RetrofitClientInstance.getInstance();
    Doc2VecService doc2VecService = retrofit.create(Doc2VecService.class);

    return Observable.fromSingle(doc2VecService.build(doc2VecRequest));
  }

  public Observable<WordEmbeddings> getEmbeddings(String input) {

    return Observable.just(new Doc2VecInference(paragraphVectors, input).inferVectors())
        .map(floatList -> new WordEmbeddings(input, floatList));
  }
}
