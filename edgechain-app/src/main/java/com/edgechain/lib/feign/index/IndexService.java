package com.edgechain.lib.feign.index;

import com.edgechain.lib.rxjava.response.ChainResponse;
import org.springframework.web.bind.annotation.RequestBody;

public interface IndexService<T> {

  ChainResponse upsert(@RequestBody T request);

  ChainResponse query(@RequestBody T request);

  ChainResponse deleteByKeys(@RequestBody T request);

  ChainResponse deleteAll(@RequestBody T request);
}
