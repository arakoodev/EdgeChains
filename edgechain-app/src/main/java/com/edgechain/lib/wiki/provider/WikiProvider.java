package com.edgechain.lib.wiki.provider;

import com.edgechain.lib.rxjava.provider.ChainProvider;
import com.edgechain.lib.rxjava.request.ChainRequest;
import com.edgechain.lib.rxjava.response.ChainResponse;
import com.edgechain.lib.rxjava.transformer.observable.EdgeChain;
import com.edgechain.lib.wiki.service.WikiService;

public class WikiProvider extends ChainProvider {

    @Override
    public EdgeChain<ChainResponse> request(ChainRequest request) {
        return new WikiService().getPageContent(request.getInput());
    }
}