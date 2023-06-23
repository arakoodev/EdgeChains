package com.edgechain.app.controllers.customPrompting;

import java.io.File;
import java.util.HashMap;
import java.util.concurrent.TimeUnit;

import org.apache.james.mime4j.dom.Multipart;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.edgechain.app.chains.ReactChain;
import com.edgechain.app.constants.WebConstants;
import com.edgechain.app.services.OpenAiService;
import com.edgechain.app.services.PluginService;
import com.edgechain.app.services.PromptService;
import com.edgechain.app.services.ToolService;
import com.edgechain.lib.openai.endpoint.Endpoint;
import com.edgechain.lib.rxjava.response.ChainResponse;
import com.edgechain.lib.rxjava.retry.impl.ExponentialDelay;

import reactor.core.publisher.Mono;

@RestController
@RequestMapping("/v1/custom")
public class CustomPromptController {
    private static final String OPENAI_CHAT_COMPLETION_API = "https://api.openai.com/v1/chat/completions";
    @Autowired
    private PromptService promptService;
    @Autowired
    private PluginService pluginService;

    @Autowired
    private OpenAiService openAiService;

    @PostMapping("/getCustomQueryResult")
    public Mono<ChainResponse> getCustomPromptResult(@RequestParam("query") String query) {
        Endpoint chatEndpoint = new Endpoint(
                OPENAI_CHAT_COMPLETION_API,
                WebConstants.OPENAI_AUTH_KEY,
                "gpt-3.5-turbo",
                "user",
                0.4,
                new ExponentialDelay(2, 3, 2, TimeUnit.SECONDS));

        String jsonnetCodeLocation = "";
        ToolService[] toolServices = { promptService, openAiService, pluginService };
        ReactChain reactChain = new ReactChain(chatEndpoint, toolServices);
        return reactChain.getCustomQuery(jsonnetCodeLocation, new HashMap<String, String>());
    }
}
