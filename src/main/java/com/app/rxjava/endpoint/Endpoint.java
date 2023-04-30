package com.app.rxjava.endpoint;

import com.app.rxjava.retry.observable.RetryPolicy;

public class Endpoint {

    private final String url;
    private final RetryPolicy retryPolicy;

    public Endpoint(String url, RetryPolicy retryPolicy) {
        this.url = url;
        this.retryPolicy = retryPolicy;
    }

    public String getUrl() {
        return url;
    }

    public RetryPolicy getRetryPolicy() {
        return retryPolicy;
    }
}
