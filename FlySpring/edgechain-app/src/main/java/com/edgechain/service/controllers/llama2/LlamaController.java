package com.edgechain.service.controllers.llama2;

import com.edgechain.lib.configuration.WebConfiguration;
import com.edgechain.lib.endpoint.impl.llm.LLamaQuickstart;
import com.edgechain.lib.llama2.LLamaClient;
import com.edgechain.lib.llama2.request.LLamaCompletionRequest;
import com.edgechain.lib.rxjava.transformer.observable.EdgeChain;
import io.reactivex.rxjava3.core.Single;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController("Service LlamaController")
@RequestMapping(value = WebConfiguration.CONTEXT_PATH + "/llama") //"llama/completion"
public class LlamaController {

  @Autowired private LLamaClient lLamaClient;

  @PostMapping(value = "/completion")
  public Single<List<String>> chatCompletion(@RequestBody LLamaQuickstart lLamaQuickstart) {

    LLamaCompletionRequest LLamaCompletionRequest =
            com.edgechain.lib.llama2.request.LLamaCompletionRequest.builder()
                    .textInputs(lLamaQuickstart.getTextInputs())
                    .returnFullText(lLamaQuickstart.getReturnFullText())
                    .topK(lLamaQuickstart.getTopK())
                    .build();

    EdgeChain<List<String>> edgeChain =
        lLamaClient.createChatCompletion(LLamaCompletionRequest, lLamaQuickstart);

    return edgeChain.toSingle();
  }
}
