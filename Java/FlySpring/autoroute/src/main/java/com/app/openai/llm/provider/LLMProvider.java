package com.app.openai.llm.provider;

import com.app.rxjava.transformer.observable.EdgeChain;

public interface LLMProvider {

  EdgeChain<String> request(String prompt);
}
