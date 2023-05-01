package com.app.openaiwiki.services.impl;

import com.app.openaiwiki.chains.PluginChain;
import com.app.openaiwiki.parser.PluginParser;
import com.app.openaiwiki.request.PluginRequest;
import com.app.openaiwiki.response.AiPluginResponse;
import com.app.openaiwiki.services.KlarnaService;
import com.app.openaiwiki.services.OpenAiClientService;
import com.app.openaiwiki.services.PluginService;
import com.app.rxjava.transformer.observable.EdgeChain;
import com.app.rxjava.utils.Atom;
import com.app.rxjava.utils.AtomInteger;
import com.fasterxml.jackson.core.JacksonException;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.reactivex.rxjava3.core.Observable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.Collections;
import java.util.Iterator;
import java.util.List;
import java.util.Objects;
@Service
public class PluginServiceImpl implements PluginService {

    private static final String DEFAULT_MESSAGE = "Couldn't extract information about: ";
    private static final Integer MAX_RETRY = 3;

    @Autowired private OpenAiClientService openAiClientService;
    @Autowired private KlarnaService klarnaService;
    @Autowired private RestTemplate restTemplate;

    @Override
    public EdgeChain<String> requestKlarna(String query) {

        AtomInteger retryCount = AtomInteger.of(0);
        Atom<Boolean> terminateWhileLoop = Atom.of(false);

        return new PluginChain(
                Observable.create(emitter -> {
                    try {

                        StringBuilder prompt = new StringBuilder();

                        // Step 1: Generate Initial Prompt using AiPluginResponse class
                        AiPluginResponse pluginResponse = klarnaService.request().get();
                        String initialPrompt = createPrompt(pluginResponse);
                        prompt.append(initialPrompt).append("\n").append(query).append("\n"); // Updating Prompt

                        // Step 4: Send The Request  & Now Append the Parse Response to Prompt;
                        String initialResponse = initializePlugin(prompt, pluginResponse).get();
                        prompt.append(initialResponse);

                        // Step 8: Fetch JSON Response from URLs extracted via ActionInput;
                        String jsonResponse = sendRequestWithOpenAPISpec(prompt).getWithOutRetry();
                        prompt.append(jsonResponse);

                        if (jsonResponse.isEmpty()) {
                            // WILL Retry FOR MAX_RETRY + 1 = 3 + 1; 4 times...
                            if(retryCount.incrementAndGet() > MAX_RETRY) {terminateWhileLoop.set(true);}
                            emitter.onNext(DEFAULT_MESSAGE + query);
                        }

                        else {
                            terminateWhileLoop.set(true);
                            emitter.onNext(this.sendExtractedJsonResponse(prompt).get());
                        }

                        emitter.onComplete();

                    } catch (final Exception e) {
                        emitter.onError(e);
                    }
                })
        ).doWhileLoop(terminateWhileLoop::get);

    }

    private PluginChain initializePlugin(StringBuilder prompt, AiPluginResponse pluginResponse) {
        return new PluginChain(
                Observable.create(emitter -> {
                    try {

                        // // Step 2: Create PluginRequest (which act as JSON body for RestTemplate) & Send POST request to OPENAPI Completion
                        PluginRequest request = new PluginRequest(prompt.toString()); // Fetching Prompt
                        this.openAiClientService.createCompletion(request).get();

                        // Step 3: Parse The Initial Response Using PluginParser
                        String parser = PluginParser.parse(pluginResponse.getPlugin().getName_for_model(), pluginResponse.getOpenApiSpec());

                        emitter.onNext(parser);
                        emitter.onComplete();
                    } catch (final Exception e) {
                        emitter.onError(e);
                    }
                })
        );
    }

    private PluginChain sendRequestWithOpenAPISpec(StringBuilder prompt) {

        return new PluginChain(

                Observable.create(emitter -> {
                    try {

                        System.out.println("Logging");

                        // Step 5: Create PluginRequest & Send To CreateCompletion OpenAPI
                        PluginRequest request = new PluginRequest(prompt.toString()); // Fetching Prompt
                        String response = this.openAiClientService.createCompletion(request).get();

                        // Step 6: Parse the Response & Fetch Http GET request from ActionInput
                        List<String> urlList = PluginParser.extractUrls(response);

                        // Step 7: Loop Over URL List & Test if anyone of them works;
                        String jsonResponse = null;

                        System.out.println("URL List: " + urlList.size());

                        Iterator<String> iterator = urlList.iterator();
                        while (iterator.hasNext()) {
                            String str = iterator.next();
                            System.out.println("URL: " + str);
                            jsonResponse = extractJsonBody(str);
                            if (Objects.nonNull(jsonResponse)) {
                                break;
                            }
                        }

                        emitter.onNext(Objects.requireNonNullElse(jsonResponse, ""));
                        emitter.onComplete();

                    } catch (final Exception e) {
                        emitter.onError(e);
                    }
                })
        );
    }

    private PluginChain sendExtractedJsonResponse(StringBuilder prompt) {
        return new PluginChain(
                Observable.create(emitter -> {
                    try {

                        PluginRequest request = new PluginRequest(prompt.toString());
                        String response = this.openAiClientService.createCompletion(request).get();

                        emitter.onNext(PluginParser.getFinalAnswer(response));
                        emitter.onComplete();
                    } catch (final Exception e) {
                        emitter.onError(e);
                    }
                })
        );
    }

    private String createPrompt(AiPluginResponse pluginResponse) {

        StringBuilder prompt = new StringBuilder();

        return prompt
                .append("Answer the following questions as best you can. You have access to the following tools: requests_get, ")
                .append(pluginResponse.getPlugin().getName_for_model()).append("\n")
                .append(pluginResponse.getPlugin().getName_for_model()).append(": ")
                .append(String.format("Call this tool to get the OpenAPI spec (and usage guide) for interacting with the %s API ", pluginResponse.getPlugin().getName_for_human()))
                .append(String.format("You should only call this ONCE! What is the %s API useful for? ", pluginResponse.getPlugin().getName_for_human()))
                .append(pluginResponse.getPlugin().getDescription_for_human()).append("\n")
                .append("requests_get: A portal to the internet. Use this when you need to get specific content from a website. Input should be a  url (i.e. https://www.google.com). The output will be the text response of the GET request. ")
                .append("\n")
                .append("Use the following format:").append("\n").append("\n")
                .append(
                        String.format(
                                "Question: the input question you must answer\n" +
                                        "Thought: you should always think about what to do\n" +
                                        "Action: the action to take, should be one of [requests_get, %s]\n" +
                                        "Action Input: the input to the action\n" +
                                        "Observation: the result of the action\n" +
                                        "... (this Thought/Action/Action Input/Observation can repeat N times)\n" +
                                        "Thought: I now know the final answer\n" +
                                        "Final Answer: the final answer to the original input question\n\n" +
                                        "Begin! And always use the openapi spec for creating the API get requests.\n"
                                , pluginResponse.getPlugin().getName_for_model())
                ).toString();
    }


    // Validating if the response is JSON & returning it;
    private String extractJsonBody(String url) {

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setAccept(Collections.singletonList(MediaType.APPLICATION_JSON));

        // Create HttpEntity with headers and body
        HttpEntity<String> entity = new HttpEntity<>(headers);

        try {
            String body = this.restTemplate.exchange(url, HttpMethod.GET, entity, String.class).getBody();

            if (isValidJSON(body)) {
                return body;
            }
            return null;
        } catch (final Exception e) {
            return null;
        }

    }


    public boolean isValidJSON(String json) {

        ObjectMapper mapper = new ObjectMapper().enable(DeserializationFeature.FAIL_ON_TRAILING_TOKENS);

        try {
            mapper.readTree(json);
        } catch (JacksonException e) {
            return false;
        }
        return true;
    }


}
