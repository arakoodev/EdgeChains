package com.edgechain.lib.index.providers.redis;

import com.edgechain.lib.configuration.context.ApplicationContextHolder;
import com.edgechain.lib.embeddings.domain.WordVec;
import com.edgechain.lib.index.services.impl.RedisIndexChain;
import com.edgechain.lib.rxjava.provider.ChainProvider;
import com.edgechain.lib.rxjava.request.ChainRequest;
import com.edgechain.lib.rxjava.response.ChainResponse;
import com.edgechain.lib.rxjava.transformer.observable.EdgeChain;
import com.edgechain.lib.utils.JsonUtils;

public class RedisUpsertProvider extends ChainProvider {
  private final RedisIndexChain redisIndexChain;

  public RedisUpsertProvider() {
    this.redisIndexChain = ApplicationContextHolder.getContext().getBean(RedisIndexChain.class);
  }

  @Override
  public EdgeChain<ChainResponse> request(ChainRequest request) {
    return this.redisIndexChain.upsert(
        JsonUtils.convertToObject(request.getInput(), WordVec.class));
  }
}
