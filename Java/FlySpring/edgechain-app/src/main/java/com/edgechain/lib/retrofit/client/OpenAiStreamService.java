package com.edgechain.lib.retrofit.client;

import com.edgechain.lib.configuration.WebConfiguration;
import com.edgechain.lib.configuration.domain.SecurityUUID;
import com.edgechain.lib.endpoint.impl.llm.OpenAiChatEndpoint;
import com.edgechain.lib.openai.response.ChatCompletionResponse;
import com.edgechain.lib.utils.JsonUtils;
import io.reactivex.rxjava3.core.Observable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.adapter.rxjava.RxJava3Adapter;

@Service
public class OpenAiStreamService {

  private final Logger logger = LoggerFactory.getLogger(getClass());

  @Autowired private SecurityUUID securityUUID;

  public Observable<ChatCompletionResponse> chatCompletion(OpenAiChatEndpoint endpoint) {

    return RxJava3Adapter.fluxToObservable(
        WebClient.builder()
            .build()
            .post()
            .uri(
                "http://0.0.0.0"
                    + ":"
                    + System.getProperty("server.port")
                    + WebConfiguration.CONTEXT_PATH
                    + "/openai/chat-completion-stream")
            .headers(
                httpHeaders -> {
                  httpHeaders.setContentType(MediaType.APPLICATION_JSON);
                  httpHeaders.set("stream", "true");
                  httpHeaders.set("Authorization", securityUUID.getAuthKey());
                })
            .bodyValue(JsonUtils.convertToString(endpoint))
            .retrieve()
            .bodyToFlux(ChatCompletionResponse.class));
  }
}
