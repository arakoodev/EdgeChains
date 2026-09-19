package com.edgechain.lib.openai.plugin.services;

import com.edgechain.lib.endpoint.Endpoint;
import com.edgechain.lib.openai.plugin.chains.PluginResponseChain;
import com.edgechain.lib.openai.plugin.response.PluginResponse;
import com.edgechain.lib.openai.plugin.tool.PluginTool;
import com.edgechain.lib.rxjava.transformer.observable.EdgeChain;
import io.reactivex.rxjava3.core.Observable;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.web.client.RestTemplate;

public class PluginResponseService {

  private RestTemplate restTemplate = new RestTemplate();

  private final Endpoint pluginEndpoint;
  private final Endpoint pluginSpecEndpoint;

  public PluginResponseService(Endpoint pluginEndpoint, Endpoint pluginSpecEndpoint) {
    this.pluginEndpoint = pluginEndpoint;
    this.pluginSpecEndpoint = pluginSpecEndpoint;
  }

  public PluginResponse getPluginResponse() {
    return new PluginResponseChain(
            Observable.create(
                emitter -> {
                  try {
                    Observable<PluginTool> obs1 =
                        this.requestPluginAPI(pluginEndpoint).getScheduledObservable();
                    Observable<String> obs2 =
                        this.requestSpecAPI(pluginSpecEndpoint).getScheduledObservable();

                    PluginResponse response =
                        new EdgeChain<>(Observable.zip(obs1, obs2, PluginResponse::new)).get();

                    emitter.onNext(response);
                    emitter.onComplete();

                  } catch (final Exception e) {
                    emitter.onError(e);
                  }
                }))
        .get();
  }

  private EdgeChain<PluginTool> requestPluginAPI(Endpoint pluginEndpoint) {
    return new EdgeChain<>(
        Observable.create(
            emitter -> {
              try {

                HttpHeaders headers = new HttpHeaders();
                headers.setContentType(MediaType.APPLICATION_JSON);
                headers.setBearerAuth(pluginEndpoint.getApiKey());

                PluginTool response =
                    this.restTemplate
                        .exchange(
                            pluginEndpoint.getUrl(),
                            HttpMethod.GET,
                            new HttpEntity<>(headers),
                            PluginTool.class)
                        .getBody();

                emitter.onNext(response);
                emitter.onComplete();

              } catch (final Exception e) {
                emitter.onError(e);
              }
            }));
  }

  private EdgeChain<String> requestSpecAPI(Endpoint pluginSpecEndpoint) {
    return new EdgeChain<>(
        Observable.create(
            emitter -> {
              try {

                HttpHeaders headers = new HttpHeaders();
                headers.setContentType(MediaType.APPLICATION_JSON);
                headers.setBearerAuth(pluginSpecEndpoint.getApiKey());

                String response =
                    this.restTemplate
                        .exchange(
                            pluginSpecEndpoint.getUrl(),
                            HttpMethod.GET,
                            new HttpEntity<>(headers),
                            String.class)
                        .getBody();

                emitter.onNext(response);
                emitter.onComplete();

              } catch (final Exception e) {
                emitter.onError(e);
              }
            }));
  }
}
