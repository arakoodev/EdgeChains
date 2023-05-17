package com.application.project.services.impl;

import com.app.openai.endpoint.Endpoint;
import com.app.openai.llm.provider.LLMProvider;
import com.app.openai.llm.provider.impl.OpenAiChatCompletionProvider;
import com.app.openai.llm.service.LLMService;
//import com.app.openai.llm.wrapper.LLMWrapper;
import com.application.project.parser.ChatWikiPrompt;
import com.application.project.parser.Scratchpad;
import com.application.project.services.BuilderService;
import com.application.project.services.ToolService;
import com.application.project.services.PluginService;
import com.app.rxjava.transformer.observable.EdgeChain;
import com.app.rxjava.utils.Atom;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.reactivex.rxjava3.core.Observable;
import io.reactivex.rxjava3.core.Single;
import reactor.core.publisher.Mono;

import java.util.concurrent.atomic.AtomicReference;

//@Service
public class ReactChain implements BuilderService {

    private final Endpoint endpoint;
    private final String question;
    private final ToolService[] toolServices;

    public Mono<String> getResponse() {
        EdgeChain<String> edgeChain = openAIWithWiki(question);
        Single<String> singleResponse = edgeChain.getScheduledObservableWithoutRetry().firstOrError();
        return Mono.from(singleResponse.toFlowable());
    }

    public ReactChain(Endpoint endpoint, String question, ToolService[] toolServices) {
        this.endpoint = endpoint;
        this.question = question;
        this.toolServices = toolServices;
    }

    private ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public EdgeChain<String> openAIWithWiki(String query) {

        /* Any Global Variable Outside Observable must be created with Atom<?> */
        Atom<String> textOutput = Atom.of(""); // Result which we want to emit; initialize with empty string;
        Atom<String> scratchString = Atom.of(""); // Input for OpenAI API
        Atom<Scratchpad> scratchPad = Atom.of(new Scratchpad("")); // Appending & Modifying Wiki-Response;
        Atom<Boolean> terminateWhileLoop = Atom.of(false);

        AtomicReference<PluginService> wikiClientServiceRef = new AtomicReference<>();

        for (ToolService toolService : toolServices) {
            if (toolService instanceof PluginService) {
                wikiClientServiceRef.set((PluginService) toolService);
                break;
            }
        }

        if (wikiClientServiceRef.get() == null) {
            throw new IllegalStateException("WikiClientService not provided");
        }

        return new EdgeChain<String>(

                Observable.create(emitter -> {
                    try {
                        LLMProvider llmProvider = new OpenAiChatCompletionProvider(endpoint);
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
                        String wikiContent = wikiClientServiceRef.get().getPageContent(actionContent).getWithRetry();
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