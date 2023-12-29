package com.edgechain.service.controllers.llama2;

import com.edgechain.lib.configuration.WebConfiguration;
import com.edgechain.lib.endpoint.impl.llm.LLamaQuickstart;
import com.edgechain.lib.llama2.Llama2Client;
import com.edgechain.lib.logger.services.ChatCompletionLogService;
import com.edgechain.lib.logger.services.JsonnetLogService;
import com.edgechain.lib.rxjava.transformer.observable.EdgeChain;
import io.reactivex.rxjava3.core.Single;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.env.Environment;
import org.springframework.web.bind.annotation.*;

@RestController("Service Llama2Controller")
@RequestMapping(value = WebConfiguration.CONTEXT_PATH + "/llama")
public class Llama2Controller {
  @Autowired private ChatCompletionLogService chatCompletionLogService;

  @Autowired private JsonnetLogService jsonnetLogService;

  @Autowired private Environment env;
  @Autowired private Llama2Client llama2Client;

  @PostMapping(value = "/chat-completion")
  public Single<String> getChatCompletion(@RequestBody LLamaQuickstart endpoint) {

    EdgeChain<String> edgeChain = llama2Client.createGetChatCompletion(endpoint);
    return edgeChain.toSingle();
  }
}
