package com.edgechain.lib.retrofit;

import com.edgechain.lib.endpoint.impl.wiki.WikiEndpoint;
import com.edgechain.lib.wiki.response.WikiResponse;
import io.reactivex.rxjava3.core.Single;
import retrofit2.http.Body;
import retrofit2.http.POST;

public interface WikiService {

  @POST(value = "wiki/page-content")
  Single<WikiResponse> getPageContent(@Body WikiEndpoint wikiEndpoint);
}
