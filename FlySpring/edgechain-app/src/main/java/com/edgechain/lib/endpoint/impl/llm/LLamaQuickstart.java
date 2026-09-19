package com.edgechain.lib.endpoint.impl.llm;

import com.edgechain.lib.endpoint.Endpoint;
import com.edgechain.lib.request.ArkRequest;
import com.edgechain.lib.retrofit.Llama2Service;
import com.edgechain.lib.retrofit.client.RetrofitClientInstance;
import com.edgechain.lib.rxjava.retry.RetryPolicy;
import io.reactivex.rxjava3.core.Observable;
import org.modelmapper.ModelMapper;
import retrofit2.Retrofit;

public class LLamaQuickstart extends Endpoint {
  private final Retrofit retrofit = RetrofitClientInstance.getInstance();
  private final Llama2Service llama2Service = retrofit.create(Llama2Service.class);
  private final ModelMapper modelMapper = new ModelMapper();
  private String query;

  public LLamaQuickstart() {}

  public LLamaQuickstart(String url, RetryPolicy retryPolicy) {
    super(url, retryPolicy);
  }

  public LLamaQuickstart(String url, RetryPolicy retryPolicy, String query) {
    super(url, retryPolicy);
    this.query = query;
  }

  public String getQuery() {
    return query;
  }

  public void setQuery(String query) {
    this.query = query;
  }

  public Observable<String> chatCompletion(String query, ArkRequest arkRequest) {
    LLamaQuickstart mapper = modelMapper.map(this, LLamaQuickstart.class);
    mapper.setQuery(query);
    return chatCompletion(mapper, arkRequest);
  }

  private Observable<String> chatCompletion(
      LLamaQuickstart lLamaQuickstart, ArkRequest arkRequest) {
    return Observable.fromSingle(this.llama2Service.llamaCompletion(lLamaQuickstart));
  }
}
