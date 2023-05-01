package com.app.rxjava.endpoint;


import com.app.rxjava.retry.flowable.RetryPolicyFlow;

public class EndpointFlow {

    private final String url;
    private final RetryPolicyFlow retryPolicy;

    public EndpointFlow(String url, RetryPolicyFlow retryPolicy) {
        this.url = url;
        this.retryPolicy = retryPolicy;
    }

    public String getUrl() {
        return url;
    }

    public RetryPolicyFlow getRetryPolicy() {
        return retryPolicy;
    }
}
