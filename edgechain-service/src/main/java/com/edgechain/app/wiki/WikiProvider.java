package com.edgechain.app.wiki;

import com.edgechain.app.services.WikiService;
import com.edgechain.lib.rxjava.provider.ChainProvider;
import com.edgechain.lib.rxjava.request.ChainRequest;
import com.edgechain.lib.rxjava.response.ChainResponse;
import com.edgechain.lib.rxjava.transformer.observable.EdgeChain;

public class WikiProvider extends ChainProvider {

    @Override
    public EdgeChain<ChainResponse> request(ChainRequest request) {
        return new WikiService().getPageContent(request.getInput());
    }
}
