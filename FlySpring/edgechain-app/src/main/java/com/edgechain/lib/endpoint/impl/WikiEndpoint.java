package com.edgechain.lib.endpoint.impl;

import com.edgechain.lib.endpoint.Endpoint;
import com.edgechain.lib.retrofit.WikiService;
import com.edgechain.lib.retrofit.client.RetrofitClientInstance;
import com.edgechain.lib.rxjava.retry.RetryPolicy;
import com.edgechain.lib.wiki.response.WikiResponse;
import io.reactivex.rxjava3.core.Observable;
import retrofit2.Retrofit;

public class WikiEndpoint extends Endpoint {

  private final Retrofit retrofit = RetrofitClientInstance.getInstance();
  private final WikiService wikiService = retrofit.create(WikiService.class);

  private String input;

  public WikiEndpoint() {}

  public WikiEndpoint(RetryPolicy retryPolicy) {
    super(retryPolicy);
    this.input = input;
  }

  public String getInput() {
    return input;
  }

  public void setInput(String input) {
    this.input = input;
  }

  public Observable<WikiResponse> getPageContent(String input) {
    this.input = input;
    return Observable.fromSingle(this.wikiService.getPageContent(this));
  }
}
