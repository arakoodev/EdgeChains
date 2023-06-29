package com.edgechain.lib.index.providers.redis;

import com.edgechain.lib.configuration.context.ApplicationContextHolder;
import com.edgechain.lib.embeddings.domain.WordVec;
import com.edgechain.lib.index.services.impl.RedisIndexChain;
import com.edgechain.lib.rxjava.provider.ChainProvider;
import com.edgechain.lib.rxjava.request.ChainRequest;
import com.edgechain.lib.rxjava.response.ChainResponse;
import com.edgechain.lib.rxjava.transformer.observable.EdgeChain;
import com.edgechain.lib.utils.JsonUtils;

import java.util.Iterator;

public class RedisQueryProvider extends ChainProvider {
  private final RedisIndexChain redisIndexChain;
  private final int topK;

  public RedisQueryProvider(int topK) {
    this.redisIndexChain = ApplicationContextHolder.getContext().getBean(RedisIndexChain.class);
    this.topK = topK;
  }

  @Override
  public EdgeChain<ChainResponse> request(ChainRequest request) {
    return this.redisIndexChain
        .query(JsonUtils.convertToObject(request.getInput(), WordVec.class), topK)
        .transform(
            w -> {
              Iterator<WordVec> iterator = w.iterator();

              StringBuilder stringBuilder = new StringBuilder();

              while (iterator.hasNext()) {
                stringBuilder.append(iterator.next().getId());
                if (iterator.hasNext()) {
                  stringBuilder.append("\n");
                }
              }

              return new ChainResponse(stringBuilder.toString());
            });
  }
}
