package com.app.openaiwiki.services;

import com.app.openaiwiki.chains.OpenAiChain;
import com.app.openaiwiki.request.PluginRequest;

public interface OpenAiClientService {

    OpenAiChain createChatCompletionV1(String inputContent, String query);
    OpenAiChain createChatCompletionV2(String inputContent, String query);

    OpenAiChain createCompletion(PluginRequest request);

    OpenAiChain createEmbeddings(String text);

}
