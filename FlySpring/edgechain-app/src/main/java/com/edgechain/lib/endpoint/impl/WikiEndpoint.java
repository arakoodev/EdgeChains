package com.edgechain.lib.endpoint.impl;

import com.edgechain.lib.configuration.context.ApplicationContextHolder;
import com.edgechain.lib.endpoint.Endpoint;
import com.edgechain.lib.feign.WikiService;
import com.edgechain.lib.rxjava.retry.RetryPolicy;
import com.edgechain.lib.wiki.request.WikiRequest;
import com.edgechain.lib.wiki.response.WikiResponse;
import io.reactivex.rxjava3.core.Observable;

public class WikiEndpoint extends Endpoint {

    private final WikiService wikiService =
            ApplicationContextHolder.getContext().getBean(WikiService.class);

    public WikiEndpoint() {}

    public WikiEndpoint(RetryPolicy retryPolicy) {
        super(retryPolicy);
    }

    public Observable<WikiResponse> getPageContent(String query) {
        return Observable.just(wikiService.getPageContent(new WikiRequest(this, query)));
    }
}
