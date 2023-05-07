package com.app.openai.endpoint;

import com.app.rxjava.retry.impl.FixedDelay;
import com.app.rxjava.retry.observable.RetryPolicy;

import java.util.concurrent.TimeUnit;

public class Endpoint {

    private static final int MAX_RETRIES = 4;
    private static final int FIXED_DELAY = 3;
    private static final TimeUnit UNIT = TimeUnit.SECONDS;

    private final String url;
    private String apiKey;
    private final RetryPolicy retryPolicy;

    public Endpoint(String url) {
        this.url = url;
        this.retryPolicy = new FixedDelay(FIXED_DELAY,MAX_RETRIES,UNIT);
    }

    public Endpoint(String url, String apiKey) {
        this.url = url;
        this.apiKey = apiKey;
        this.retryPolicy = new FixedDelay(FIXED_DELAY,MAX_RETRIES,UNIT);
    }

    public Endpoint(String url, String apiKey, RetryPolicy retryPolicy) {
        this.url = url;
        this.apiKey = apiKey;
        this.retryPolicy = retryPolicy;
    }

    public Endpoint(String url, RetryPolicy retryPolicy) {
        this.url = url;
        this.retryPolicy = retryPolicy;
    }

    public String getApiKey() {
        return apiKey;
    }

    public String getUrl() {
        return url;
    }

    public RetryPolicy getRetryPolicy() {
        return retryPolicy;
    }
}
