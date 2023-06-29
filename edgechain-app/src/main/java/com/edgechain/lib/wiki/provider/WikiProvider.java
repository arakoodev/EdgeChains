package com.edgechain.lib.wiki.provider;

import com.edgechain.lib.rxjava.provider.ChainProvider;
import com.edgechain.lib.rxjava.request.ChainRequest;
import com.edgechain.lib.rxjava.response.ChainResponse;
import com.edgechain.lib.rxjava.transformer.observable.EdgeChain;
import com.edgechain.lib.wiki.client.WikiClient;
import me.xuender.unidecode.Unidecode;

public class WikiProvider extends ChainProvider {

  @Override
  public EdgeChain<ChainResponse> request(ChainRequest request) {
    return new WikiClient()
        .getPageContent(request.getInput())
        .transform(
            wiki ->
                new ChainResponse(
                    Unidecode.decode(wiki.getResponse()).replaceAll("[\t\n\r]+", " ")));
  }
}
