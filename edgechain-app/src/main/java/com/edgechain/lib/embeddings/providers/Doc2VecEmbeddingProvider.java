package com.edgechain.lib.embeddings.providers;

import com.edgechain.lib.embeddings.domain.WordVec;
import com.edgechain.lib.embeddings.services.Doc2VecInference;
import com.edgechain.lib.utils.JsonUtils;
import com.edgechain.lib.rxjava.provider.ChainProvider;
import com.edgechain.lib.rxjava.request.ChainRequest;
import com.edgechain.lib.rxjava.response.ChainResponse;
import com.edgechain.lib.rxjava.transformer.observable.EdgeChain;
import io.reactivex.rxjava3.core.Observable;
import org.deeplearning4j.models.paragraphvectors.ParagraphVectors;

import java.util.List;

public class Doc2VecEmbeddingProvider extends ChainProvider {

  private final ParagraphVectors paragraphVectors;

  public Doc2VecEmbeddingProvider(ParagraphVectors paragraphVectors) {
    this.paragraphVectors = paragraphVectors;
  }

  @Override
  public EdgeChain<ChainResponse> request(ChainRequest request) {
    List<Float> embeddings =
        new Doc2VecInference(paragraphVectors, request.getInput()).inferVectors();
    WordVec wordVec = new WordVec(request.getInput(), embeddings);
    return new EdgeChain<>(Observable.just(new ChainResponse(JsonUtils.convertToString(wordVec))));
  }
}
