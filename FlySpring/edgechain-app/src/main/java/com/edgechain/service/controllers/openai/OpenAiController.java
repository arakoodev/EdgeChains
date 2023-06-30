package com.edgechain.service.controllers.openai;

import com.edgechain.lib.constants.WebConstants;
import com.edgechain.lib.openai.providers.OpenAiChatCompletionProvider;
import com.edgechain.lib.openai.providers.OpenAiChatCompletionStreamProvider;
import com.edgechain.lib.openai.providers.OpenAiCompletionProvider;
import com.edgechain.lib.request.OpenAiChatRequest;
import com.edgechain.lib.request.OpenAiCompletionRequest;
import com.edgechain.lib.rxjava.request.ChainRequest;
import com.edgechain.lib.rxjava.response.ChainResponse;
import com.edgechain.lib.rxjava.wrapper.ChainWrapper;

import io.reactivex.rxjava3.core.Observable;
import io.reactivex.rxjava3.core.Single;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;

@RestController("Service OpenAiController")
@RequestMapping(value = WebConstants.SERVICE_CONTEXT_PATH + "/openai")
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
