package com.edgechain.service.controllers.openai;

import com.edgechain.app.constants.WebConstants;
import com.edgechain.lib.openai.endpoint.Endpoint;
import com.edgechain.lib.openai.providers.OpenAiChatCompletionProvider;
import com.edgechain.lib.openai.providers.OpenAiChatCompletionStreamProvider;
import com.edgechain.lib.openai.providers.OpenAiCompletionProvider;
import com.edgechain.lib.openai.request.ChatCompletionRequest;
import com.edgechain.lib.openai.request.ChatMessage;
import com.edgechain.lib.openai.response.ChatCompletionResponse;
import com.edgechain.lib.request.OpenAiChatRequest;
import com.edgechain.lib.request.OpenAiCompletionRequest;
import com.edgechain.lib.rxjava.request.ChainRequest;
import com.edgechain.lib.rxjava.response.ChainResponse;
import com.edgechain.lib.rxjava.retry.impl.ExponentialDelay;
import com.edgechain.lib.rxjava.retry.impl.FixedDelay;
import com.edgechain.lib.rxjava.wrapper.ChainWrapper;

import com.edgechain.lib.utils.JsonUtils;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.reactivex.rxjava3.core.BackpressureStrategy;
import io.reactivex.rxjava3.core.Observable;
import io.reactivex.rxjava3.core.Single;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.adapter.rxjava.RxJava3Adapter;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import javax.print.attribute.standard.Media;
import java.util.List;
import java.util.concurrent.TimeUnit;

import static com.edgechain.app.constants.WebConstants.OPENAI_AUTH_KEY;
import static com.edgechain.app.constants.WebConstants.OPENAI_CHAT_COMPLETION_API;

@RestController
@RequestMapping("/v1/openai")
public class OpenAiController {

  @PostMapping(value = "/chat-completion")
  public Single<ChainResponse> chatCompletion(@RequestBody OpenAiChatRequest request) {

    OpenAiChatCompletionProvider chatCompletion =
        new OpenAiChatCompletionProvider(request.getEndpoint());

    ChainWrapper wrapper = new ChainWrapper();
    return wrapper.chains(new ChainRequest(request.getInput()), chatCompletion).toSingleWithRetry();
  }

  @PostMapping(
      value = "/chat-completion-stream",
      consumes = {MediaType.APPLICATION_JSON_VALUE},
      produces = {MediaType.TEXT_EVENT_STREAM_VALUE})
  public Observable<ChainResponse> chatCompletionStream(@RequestBody OpenAiChatRequest request) {

    OpenAiChatCompletionStreamProvider chatCompletion =
        new OpenAiChatCompletionStreamProvider(request.getEndpoint());

    ChainWrapper wrapper = new ChainWrapper();
    return wrapper
        .chains(new ChainRequest(request.getInput()), chatCompletion)
        .getScheduledObservableWithRetry();
  }

  @PostMapping("/completion")
  public Single<ChainResponse> completion(@RequestBody OpenAiCompletionRequest request) {

    OpenAiCompletionProvider provider = new OpenAiCompletionProvider(request.getEndpoint());

    ChainWrapper wrapper = new ChainWrapper();
    return wrapper.chains(new ChainRequest(request.getInput()), provider).toSingleWithRetry();
  }
}
