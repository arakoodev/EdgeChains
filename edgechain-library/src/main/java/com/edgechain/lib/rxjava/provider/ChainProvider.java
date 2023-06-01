package com.edgechain.lib.rxjava.provider;

import com.edgechain.lib.rxjava.request.ChainRequest;
import com.edgechain.lib.rxjava.response.ChainResponse;
import com.edgechain.lib.rxjava.transformer.observable.EdgeChain;

import java.io.Serializable;

public abstract class ChainProvider implements Serializable {

   private static final long serialVersionUID = -6654030528172116101L;

   public abstract EdgeChain<ChainResponse> request(ChainRequest request);

}
