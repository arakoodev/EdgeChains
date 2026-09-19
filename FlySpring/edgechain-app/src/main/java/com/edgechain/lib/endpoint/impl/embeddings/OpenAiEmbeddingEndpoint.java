package com.edgechain.lib.endpoint.impl.embeddings;

import com.edgechain.lib.embeddings.WordEmbeddings;
import com.edgechain.lib.request.ArkRequest;
import com.edgechain.lib.retrofit.OpenAiService;
import com.edgechain.lib.retrofit.client.RetrofitClientInstance;
import com.edgechain.lib.rxjava.retry.RetryPolicy;
import io.reactivex.rxjava3.core.Observable;
import org.modelmapper.ModelMapper;
import retrofit2.Retrofit;

import java.util.Objects;

public class OpenAiEmbeddingEndpoint extends EmbeddingEndpoint {

  private final Retrofit retrofit = RetrofitClientInstance.getInstance();
  private final OpenAiService openAiService = retrofit.create(OpenAiService.class);

  private ModelMapper modelMapper = new ModelMapper();

  private String orgId;
  private String model;

  public OpenAiEmbeddingEndpoint() {}

  public OpenAiEmbeddingEndpoint(String url, String apiKey, String orgId, String model) {
    super(url, apiKey);
    this.orgId = orgId;
    this.model = model;
  }

  public OpenAiEmbeddingEndpoint(
      String url, String apiKey, String orgId, String model, RetryPolicy retryPolicy) {
    super(url, apiKey, retryPolicy);
    this.orgId = orgId;
    this.model = model;
  }

  public String getModel() {
    return model;
  }

  public String getOrgId() {
    return orgId;
  }

  public void setOrgId(String orgId) {
    this.orgId = orgId;
  }

  public void setModel(String model) {
    this.model = model;
  }

  @Override
  public Observable<WordEmbeddings> embeddings(String input, ArkRequest arkRequest) {

    OpenAiEmbeddingEndpoint mapper = modelMapper.map(this, OpenAiEmbeddingEndpoint.class);
    mapper.setRawText(input);

    if (Objects.nonNull(arkRequest)) mapper.setCallIdentifier(arkRequest.getRequestURI());
    else mapper.setCallIdentifier("URI wasn't provided");

    return Observable.fromSingle(
        openAiService
            .embeddings(mapper)
            .map(
                embeddingResponse ->
                    new WordEmbeddings(input, embeddingResponse.getData().get(0).getEmbedding())));
  }
}
