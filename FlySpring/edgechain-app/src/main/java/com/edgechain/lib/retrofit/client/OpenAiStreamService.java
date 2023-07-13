package com.edgechain.lib.retrofit.client;

import com.edgechain.lib.endpoint.impl.OpenAiEndpoint;
import com.edgechain.lib.openai.response.ChatCompletionResponse;
import com.edgechain.lib.utils.JsonUtils;
import io.reactivex.rxjava3.core.Observable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.adapter.rxjava.RxJava3Adapter;

@Service
public class OpenAiStreamService {

  private final Logger logger = LoggerFactory.getLogger(getClass());

  public Observable<ChatCompletionResponse> chatCompletion(OpenAiEndpoint openAiEndpoint) {

    logger.info("Logging Chat Completion Stream....");
    logger.info("Prompt: " + openAiEndpoint.getInput());

    return RxJava3Adapter.fluxToObservable(
        WebClient.builder()
            .build()
            .post()
            .uri(
                "http://0.0.0.0"
                    + ":"
                    + System.getProperty("server.port")
                    + "/v2"
                    + "/openai/chat-completion-stream")
            .headers(
                httpHeaders -> {
                  httpHeaders.setContentType(MediaType.APPLICATION_JSON);
                })
            .bodyValue(JsonUtils.convertToString(openAiEndpoint))
            .retrieve()
            .bodyToFlux(ChatCompletionResponse.class));
  }
}
