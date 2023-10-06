package com.edgechain.service.controllers.llama2;

import com.edgechain.lib.configuration.WebConfiguration;
import com.edgechain.lib.endpoint.impl.llm.Llama2Endpoint;
import com.edgechain.lib.llama2.Llama2Client;
import com.edgechain.lib.llama2.request.Llama2ChatCompletionRequest;
import com.edgechain.lib.llama2.response.Llama2ChatCompletionResponse;
import com.edgechain.lib.logger.services.ChatCompletionLogService;
import com.edgechain.lib.logger.services.JsonnetLogService;
import com.edgechain.lib.rxjava.transformer.observable.EdgeChain;
import io.reactivex.rxjava3.core.Single;
import org.json.JSONObject;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.env.Environment;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Collections;
import java.util.List;

@RestController("Service Llama2Controller")
@RequestMapping(value = WebConfiguration.CONTEXT_PATH + "/llama2")
public class Llama2Controller {
    @Autowired
    private ChatCompletionLogService chatCompletionLogService;

    @Autowired private JsonnetLogService jsonnetLogService;

    @Autowired private Environment env;
    @Autowired private Llama2Client llama2Client;

    @PostMapping(value = "/chat-completion")
    public Single<List<Llama2ChatCompletionResponse>> chatCompletion(@RequestBody Llama2Endpoint llama2Endpoint) {

        System.out.println("\nI'm in controller class\n");

        JSONObject parameters = new JSONObject();
        parameters.put("do_sample", llama2Endpoint.getDoSample());
        parameters.put("top_p", llama2Endpoint.getTopP());
        parameters.put("temperature", llama2Endpoint.getTemperature());
        parameters.put("top_k", llama2Endpoint.getTopK());
        parameters.put("max_new_tokens", llama2Endpoint.getMaxNewTokens());
        parameters.put("repetition_penalty", llama2Endpoint.getRepetitionPenalty());
        parameters.put("stop", llama2Endpoint.getStop() != null ? llama2Endpoint.getStop() : Collections.emptyList());

        System.out.println("\nI'm in controller class after json object\n");

        Llama2ChatCompletionRequest llama2ChatCompletionRequest =
                Llama2ChatCompletionRequest.builder().inputs(llama2Endpoint.getInputs()).parameters(parameters).build();

        EdgeChain<List<Llama2ChatCompletionResponse>> edgeChain =
                llama2Client.createChatCompletion(llama2ChatCompletionRequest, llama2Endpoint);

            return edgeChain.toSingle();
    }
}
