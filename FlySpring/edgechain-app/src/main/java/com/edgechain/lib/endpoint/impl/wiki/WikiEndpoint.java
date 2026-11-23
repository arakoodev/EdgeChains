package com.edgechain.lib.endpoint.impl.wiki;

import com.edgechain.lib.endpoint.Endpoint;
import com.edgechain.lib.retrofit.WikiService;
import com.edgechain.lib.retrofit.client.RetrofitClientInstance;
import com.edgechain.lib.rxjava.retry.RetryPolicy;
import com.edgechain.lib.wiki.response.WikiResponse;
import io.reactivex.rxjava3.core.Observable;
import org.modelmapper.ModelMapper;
import retrofit2.Retrofit;

public class WikiEndpoint extends Endpoint {

  private final Retrofit retrofit = RetrofitClientInstance.getInstance();
  private final WikiService wikiService = retrofit.create(WikiService.class);

  private ModelMapper modelMapper = new ModelMapper();

  private String input;

  public WikiEndpoint() {}

  public WikiEndpoint(RetryPolicy retryPolicy) {
    super(retryPolicy);
  }

  public String getInput() {
    return input;
  }

  public void setInput(String input) {
    this.input = input;
  }

  public Observable<WikiResponse> getPageContent(String input) {
    WikiEndpoint mapper = modelMapper.map(this, WikiEndpoint.class);
    mapper.setInput(input);
    return Observable.fromSingle(this.wikiService.getPageContent(mapper));
  }
}
