package com.edgechain.lib.endpoint.impl.embeddings;

import com.edgechain.lib.embeddings.WordEmbeddings;
import com.edgechain.lib.embeddings.miniLLM.enums.MiniLMModel;
import com.edgechain.lib.request.ArkRequest;
import com.edgechain.lib.retrofit.MiniLMService;
import com.edgechain.lib.retrofit.client.RetrofitClientInstance;
import com.edgechain.lib.rxjava.retry.RetryPolicy;
import java.util.Objects;

import io.reactivex.rxjava3.core.Observable;
import org.modelmapper.ModelMapper;
import retrofit2.Retrofit;

public class MiniLMEndpoint extends EmbeddingEndpoint {

  private final Retrofit retrofit = RetrofitClientInstance.getInstance();
  private final MiniLMService miniLMService = retrofit.create(MiniLMService.class);
  private ModelMapper modelMapper = new ModelMapper();

  private MiniLMModel miniLMModel;

  public MiniLMEndpoint() {}

  public MiniLMEndpoint(MiniLMModel miniLMModel) {
    this.miniLMModel = miniLMModel;
  }

  public void setMiniLMModel(MiniLMModel miniLMModel) {
    this.miniLMModel = miniLMModel;
  }

  public MiniLMModel getMiniLMModel() {
    return miniLMModel;
  }

  public MiniLMEndpoint(RetryPolicy retryPolicy, MiniLMModel miniLMModel) {
    super(retryPolicy);
    this.miniLMModel = miniLMModel;
  }

  @Override
  public Observable<WordEmbeddings> embeddings(String input, ArkRequest arkRequest) {

    MiniLMEndpoint mapper = modelMapper.map(this, MiniLMEndpoint.class);
    mapper.setRawText(input);

    if (Objects.nonNull(arkRequest)) mapper.setCallIdentifier(arkRequest.getRequestURI());
    else mapper.setCallIdentifier("URI wasn't provided");

    return Observable.fromSingle(
        miniLMService.embeddings(mapper).map(m -> new WordEmbeddings(input, m.getEmbedding())));
  }
}
