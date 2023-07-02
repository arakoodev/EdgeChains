package com.edgechain.lib.endpoint.impl;

import com.edgechain.lib.configuration.context.ApplicationContextHolder;
import com.edgechain.lib.context.domain.HistoryContext;
import com.edgechain.lib.endpoint.Endpoint;
import com.edgechain.lib.feign.RedisContextService;
import com.edgechain.lib.rxjava.retry.RetryPolicy;

import java.util.HashMap;
import java.util.Objects;

public class RedisEndpoint extends Endpoint {

    private RedisContextService contextService = ApplicationContextHolder.getContext().getBean(RedisContextService.class);

    public RedisEndpoint() {
    }

    public RedisEndpoint(RetryPolicy retryPolicy) {
        super(retryPolicy);
    }

    public HistoryContext createHistoryContext(String key) {

        if( Objects.nonNull(key) && !key.isEmpty()) {
            Boolean c = contextService.check(key);
            if(c)  {
                return contextService.get(key);
            }
            else {
                return contextService.create();
            }
        }
        else
            return contextService.create();
    }

    public HistoryContext update(String key, String response) {

        HashMap<String,String> mapper = new HashMap<>();
        mapper.put("key", key);
        mapper.put("response", response);

       return contextService.update(mapper);
    }
}
