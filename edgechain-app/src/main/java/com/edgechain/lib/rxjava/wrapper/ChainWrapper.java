package com.edgechain.lib.rxjava.wrapper;

import com.edgechain.lib.rxjava.provider.ChainProvider;
import com.edgechain.lib.rxjava.request.ChainRequest;
import com.edgechain.lib.rxjava.response.ChainResponse;
import com.edgechain.lib.rxjava.transformer.observable.EdgeChain;
import io.reactivex.rxjava3.core.Observable;

/**
 * Inspired from the implementation of Tuple<?,?> & Observable.zip(). ChainWrapper is the primary
 * executor class for Chains...
 */
public class ChainWrapper {

  public EdgeChain<ChainResponse> chains(ChainRequest request, ChainProvider chain) {
    return chain.request(request);
  }

  public EdgeChain<ChainResponse> chains(
      ChainRequest request, ChainProvider chain1, ChainProvider chain2) {
    return chain1
        .request(request)
        .transform(c1 -> chain2.request(new ChainRequest(c1.getResponse())))
        .doOnError(System.err::println)
        .getWithRetry();
  }

  public EdgeChain<ChainResponse> chains(
      ChainRequest request, ChainProvider chain1, ChainProvider chain2, ChainProvider chain3) {
    return chain1
        .request(request)
        .transform(c1 -> chain2.request(new ChainRequest(c1.getResponse())).getWithRetry())
        .transform(c2 -> chain3.request(new ChainRequest(c2.getResponse())))
        .doOnError(System.err::println)
        .getWithRetry();
  }

  public EdgeChain<ChainResponse> chains(
      ChainRequest request,
      ChainProvider chain1,
      ChainProvider chain2,
      ChainProvider chain3,
      ChainProvider chain4) {
    return chain1
        .request(request)
        .transform(c1 -> chain2.request(new ChainRequest(c1.getResponse())).getWithRetry())
        .transform(c2 -> chain3.request(new ChainRequest(c2.getResponse())))
        .getWithRetry()
        .transform(c3 -> chain4.request(new ChainRequest(c3.getResponse())))
        .doOnError(System.err::println)
        .getWithRetry();
  }

  public static boolean isValidIndex(ChainProvider[] arr, int index) {
    return index >= 0 && index < arr.length;
  }
}
