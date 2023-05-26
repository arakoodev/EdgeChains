// package com.app.openai.llm.wrapper;
//
// import com.app.openai.endpoint.Endpoint;
// import com.app.openai.llm.provider.LLMProvider;
// import com.app.openai.llm.provider.impl.OpenAiChatCompletionProvider;
// import com.app.openai.llm.service.LLMService;
// import com.app.rxjava.transformer.observable.EdgeChain;
//
// public class LLMWrapper {
//
//    private final String prompt;
//
//    private static final String OPENAI_CHAT_COMPLETION_API =
// "https://api.openai.com/v1/chat/completions";
//
//    public LLMWrapper(String prompt) {
//        this.prompt = prompt;
//    }
//
//    public  EdgeChain<String> request(LLMProvider provider) {
//        LLMService llmService = new LLMService(provider);
//        return llmService.request(prompt);
//    }
//
//    public EdgeChain<String> chatCompletion(String OPENAI_API_KEY,  String model, String role){
//        OpenAiChatCompletionProvider provider = new OpenAiChatCompletionProvider
//                (new Endpoint(OPENAI_CHAT_COMPLETION_API, OPENAI_API_KEY), model, role);
//
//       return request(provider);
//    }
// }
