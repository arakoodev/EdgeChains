package com.app.openaiwiki.services;

import com.app.openaiwiki.chains.PluginChain;
import com.app.rxjava.transformer.observable.EdgeChain;

public interface PluginService {


    EdgeChain<String> requestKlarna(String query);

}
