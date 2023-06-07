package com.edgechain.app.services.abstracts;

import com.edgechain.lib.request.PineconeRequest;
import com.edgechain.lib.rxjava.response.ChainResponse;
import org.springframework.web.bind.annotation.RequestBody;

public interface IndexService<T> {

  ChainResponse upsert(@RequestBody T request);

  ChainResponse query(@RequestBody T request);

  ChainResponse deleteByKeys(@RequestBody T request);

  ChainResponse deleteAll(@RequestBody T request);
}
