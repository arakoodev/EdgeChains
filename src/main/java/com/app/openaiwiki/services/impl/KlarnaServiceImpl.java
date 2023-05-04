package com.app.openaiwiki.services.impl;

import com.app.openaiwiki.chains.KlarnaChain;
import com.app.openaiwiki.plugins.PluginTool;
import com.app.openaiwiki.response.AiPluginResponse;
import com.app.openaiwiki.services.KlarnaService;
import com.app.rxjava.transformer.observable.EdgeChain;
import com.app.rxjava.transformer.observable.Transformer;
import io.reactivex.rxjava3.core.Observable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

@Service
public class KlarnaServiceImpl implements KlarnaService {

    private static final String KLARNA_PLUGIN_URL = "https://www.klarna.com/.well-known/ai-plugin.json";
    private static final String KLARNA_OPENAPI = "https://www.klarna.com/us/shopping/public/openai/v0/api-docs/";

    @Autowired
    private RestTemplate restTemplate;

    @Override
    public KlarnaChain request() {
        return new KlarnaChain(
                Observable.create(emitter -> {
                    try {

                        Observable<PluginTool> obs1 = this.requestPluginUrl().getRetryScheduledObservable();
                        Observable<String> obs2 = this.requestOpenAPISpec().getRetryScheduledObservable();

                        AiPluginResponse aiPluginResponse = new Transformer<>(Observable.zip(obs1, obs2, AiPluginResponse::new)).get();

                        emitter.onNext(aiPluginResponse);
                        emitter.onComplete();

                    } catch (final Exception e) {
                        emitter.onError(e);
                    }
                })
        );
    }

    private EdgeChain<PluginTool> requestPluginUrl() {
        return new Transformer<>(
                Observable.create(emitter -> {
                    try {

                        PluginTool klarnaPluginInfo = this.restTemplate.getForEntity(KLARNA_PLUGIN_URL, PluginTool.class).getBody();
                        emitter.onNext(klarnaPluginInfo);
                        emitter.onComplete();

                    } catch (final Exception e) {
                        emitter.onError(e);
                    }
                })
        );
    }

    private EdgeChain<String> requestOpenAPISpec() {
        return new Transformer<>(
                Observable.create(emitter -> {
                    try {

                        String body = this.restTemplate.getForEntity(KLARNA_OPENAPI, String.class).getBody();
                        emitter.onNext(body);
                        emitter.onComplete();

                    } catch (final Exception e) {
                        emitter.onError(e);
                    }
                })
        );
    }


}
