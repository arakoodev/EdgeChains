package com.app.openai.plugin.services;

import com.app.openai.chains.PluginResponseChain;
import com.app.openai.endpoint.Endpoint;
import com.app.openai.plugin.response.PluginResponse;
import com.app.openai.plugin.tool.PluginTool;
import com.app.rxjava.transformer.observable.EdgeChain;
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
                        this.requestPluginAPI(pluginEndpoint).getScheduledObservableWithRetry();
                    Observable<String> obs2 =
                        this.requestSpecAPI(pluginSpecEndpoint).getScheduledObservableWithRetry();

                    PluginResponse response =
                        new EdgeChain<>(Observable.zip(obs1, obs2, PluginResponse::new))
                            .getWithOutRetry();

                    emitter.onNext(response);
                    emitter.onComplete();

                  } catch (final Exception e) {
                    emitter.onError(e);
                  }
                }))
        .getWithOutRetry();
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
