package com.app.openaiwiki.services.impl;

import com.app.openai.endpoint.Endpoint;
import com.app.openai.llm.provider.LLMProvider;
import com.app.openai.llm.provider.impl.OpenAiChatCompletionProvider;
import com.app.openai.llm.service.LLMService;
import com.app.openaiwiki.parser.Scratchpad;
import com.app.openaiwiki.prompt.ChatWikiPrompt;
import com.app.openaiwiki.services.BuilderService;
import com.app.openaiwiki.services.WikiClientService;
import com.app.rxjava.retry.impl.ExponentialDelay;
import com.app.rxjava.transformer.observable.EdgeChain;
import com.app.rxjava.utils.Atom;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.reactivex.rxjava3.core.Observable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.concurrent.TimeUnit;

@Service
public class BuilderServiceImpl implements BuilderService {

    private static final String OPENAI_CHAT_COMPLETION_API = "https://api.openai.com/v1/chat/completions";
    private static final String OPENAI_API_KEY = "";

    @Autowired private WikiClientService wikiClientService;
    @Autowired private ObjectMapper objectMapper;

    @Override
    public EdgeChain<String> openAIWithWiki(String query) {

        /* Any Global Variable Outside Observable must be created with Atom<?> */
        Atom<String> textOutput = Atom.of(""); // Result which we want to emit; initialize with empty string;
        Atom<String> scratchString = Atom.of(""); // Input for OpenAI API
        Atom<Scratchpad> scratchPad = Atom.of(new Scratchpad("")); // Appending & Modifying Wiki-Response;
        Atom<Boolean> terminateWhileLoop = Atom.of(false);

        return new EdgeChain<String>(

                Observable.create(emitter -> {
                    try {

                        Endpoint endpoint = new Endpoint(OPENAI_CHAT_COMPLETION_API, OPENAI_API_KEY,
                                new ExponentialDelay(2,3,2, TimeUnit.SECONDS));

                        LLMProvider llmProvider =
                                new OpenAiChatCompletionProvider(endpoint, "gpt-3.5-turbo", "user");

                        LLMService llmService = new LLMService(llmProvider);

                        // Building & Appending prompt
                        String prompt = new ChatWikiPrompt().getPrompt() + "\n" + query + "\n" + scratchString.get();
                        String responseBody = llmService.request(prompt).getWithRetry();

                        // Step 2: Set the parse JSON response
                        String textOutput_ = textOutput.set(parse(responseBody));

                        // Step 3: Set ScratchPad (TextOutput)
                        scratchPad.set(new Scratchpad(textOutput_));

                        String actionContent = scratchPad.get().getActionContent();
                        System.out.println("Action Content: " + actionContent); // Logging Purpose

                        /* Define While Loop Condition */
                        if (actionContent == null) terminateWhileLoop.set(true);

                        // Step 5: Send Request To Wiki & Modify the response
                        String wikiContent = wikiClientService.getPageContent(actionContent).getWithRetry();
                        scratchPad.get().observationReplacer(wikiContent);

                        // Step 6: Create StringBuilder
                        StringBuilder stringBuilder = new StringBuilder(scratchString.get());

                        for (String line : scratchPad.get().getScratchpadList()) {
                            stringBuilder.append(line).append("\n");
                        }

                        // Step 7: Update ScratchString (which shall be used for OpenAI Request)
                        scratchString.set(stringBuilder.toString());

                        // Step 8: Emit the Response & Complete
                        emitter.onNext(textOutput_);
//                        System.out.println("Text: " + textOutput_); // Logging Purpose

                        emitter.onComplete();

                    } catch (final Exception e) {
                        emitter.onError(e);
                    }
                })
        ).doWhileLoop(terminateWhileLoop::get);
    }


    private String parse(String body) throws JsonProcessingException {
        JsonNode outputJsonNode = objectMapper.readTree(body);
        System.out.println("Pretty String: " + outputJsonNode.toPrettyString());

        return outputJsonNode.get("choices").get(0).get("message").get("content").asText();
    }

}
