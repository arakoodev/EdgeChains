package com.edgechain.lib.jsonFormat.controller;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.edgechain.lib.constants.EndpointConstants;
import com.edgechain.lib.endpoint.impl.OpenAiEndpoint;
import com.edgechain.lib.jsonFormat.dto.FunctionRequest;
import com.edgechain.lib.jsonFormat.dto.MessagesRequest;
import com.edgechain.lib.jsonFormat.dto.MultiplePromptRequest;
import com.edgechain.lib.jsonFormat.dto.Parameter;
import com.edgechain.lib.jsonFormat.dto.UserPromptRequest;
import com.edgechain.lib.rxjava.retry.impl.ExponentialDelay;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import io.reactivex.rxjava3.core.Single;

@RestController
@RequestMapping("/json")
public class JsonFormat {

        private final String OPENAI_AUTH_KEY = "";
        private final String OPENAI_ORG_ID = "";

        @GetMapping("/extract")
        public Single<String> extract(@RequestBody UserPromptRequest UserPromptRequest) {
                String rePrompt = "INPUT = " + UserPromptRequest.getPrompt() + " EXTRACTED = "
                                + UserPromptRequest.getFormat()
                                + " Return EXTRACTED as a valid JSON object.";
                System.out.println(rePrompt);

                OpenAiEndpoint userChat = new OpenAiEndpoint(
                                EndpointConstants.OPENAI_CHAT_COMPLETION_API,
                                OPENAI_AUTH_KEY,
                                "gpt-3.5-turbo",
                                "user",
                                0.7,
                                new ExponentialDelay(3, 5, 2, TimeUnit.SECONDS));

                String gptResponse = userChat.getChatCompletion(rePrompt).blockingFirst().getChoices().get(0)
                                .getMessage()
                                .getContent();

                if (gptResponse == null) {
                        System.out.println("ChatGptResponse is null. There was an error processing the request.");
                        return Single.just("ChatGptResponse is null. There was an error processing the request.");
                }

                // Verify if the return message is a valid JSON string
                ObjectMapper objectMapper = new ObjectMapper();
                try {
                        JsonNode jsonNode = objectMapper.readTree(gptResponse);
                        System.out.println("The response is a valid JSON string." + jsonNode);
                } catch (Exception e) {
                        System.out.println("The response is not a valid JSON string.");
                }

                return Single.just(gptResponse);
        }

        @GetMapping("/situation")
        public String handleSituation(@RequestBody MultiplePromptRequest multiplePromptRequest) {

                OpenAiEndpoint userChat = new OpenAiEndpoint(
                                EndpointConstants.OPENAI_CHAT_COMPLETION_API,
                                OPENAI_AUTH_KEY,
                                OPENAI_ORG_ID,
                                "gpt-3.5-turbo",
                                "user",
                                0.7,
                                false,
                                new ExponentialDelay(3, 5, 2, TimeUnit.SECONDS));

                String getActionPrompt = "This is the situation: " + multiplePromptRequest.getSituation()
                                + " These are the set of valid actions to take: "
                                + multiplePromptRequest.getValidAction() + " "
                                + multiplePromptRequest.getCallToAction();
                ;
                String response1 = userChat.getChatCompletion(getActionPrompt).blockingFirst().getChoices().get(0)
                                .getMessage()
                                .getContent();
                System.out.println("response1: " + response1);

                String validActionCheckPrompt = "Given the situation: " + multiplePromptRequest.getSituation()
                                + " And the action you chose: " + response1
                                + " Is the action you in this set of valid actions: "
                                + multiplePromptRequest.getValidAction()
                                + "? If not, choose the best valid action to take. If so, please return the original action";
                String response2 = userChat.getChatCompletion(validActionCheckPrompt).blockingFirst().getChoices()
                                .get(0)
                                .getMessage()
                                .getContent();
                System.out.println("response2: " + response2);

                String getActionFormat = "This is the correct format for an action: "
                                + multiplePromptRequest.getActionFormat()
                                + " This is the chosen action: " + response2
                                + " Convert the chosen action to the correct format.";
                String response3 = userChat.getChatCompletion(getActionFormat).blockingFirst().getChoices().get(0)
                                .getMessage()
                                .getContent();
                System.out.println("response3: " + response3);

                try {
                        ObjectMapper objectMapper = new ObjectMapper();
                        JsonNode jsonNode = objectMapper.readTree(response3);
                        System.out.println("The response is a valid JSON string." + jsonNode);
                        return response3;
                } catch (Exception e) {
                        System.out.println("The response is not a valid JSON string so retrying.");
                        String getValidFormat = "This is the correct format for an action: "
                                        + multiplePromptRequest.getActionFormat()
                                        + " This is a formatted action: " + response3
                                        + " Return the action in the correct format.";
                        String response4 = userChat.getChatCompletion(getValidFormat).blockingFirst().getChoices()
                                        .get(0)
                                        .getMessage()
                                        .getContent();
                        System.out.println("Final Response: " + response4);
                        return response4;
                }

        }

        // still woking on
        @GetMapping("/function")
        public String function(@RequestBody UserPromptRequest userPromptRequest) {

                FunctionRequest functions = new FunctionRequest("reply_user", "reply to user's query",
                                new Parameter("object", userPromptRequest.getFormat()));

                List<MessagesRequest> messages = new ArrayList<MessagesRequest>();
                messages.add(new MessagesRequest("system",
                                "Only use function_call to reply to use. Do not use content"));
                messages.add(new MessagesRequest("user", userPromptRequest.prompt));

                OpenAiEndpoint userChat = new OpenAiEndpoint(
                                EndpointConstants.OPENAI_CHAT_COMPLETION_API,
                                OPENAI_AUTH_KEY,
                                OPENAI_ORG_ID,
                                "gpt-3.5-turbo-0613",
                                messages,
                                0.7,
                                functions,
                                "auto");
                String gptResponse = userChat.getChatCompletion("").blockingFirst().getChoices().get(0).getMessage()
                                .getContent();

                System.out.println(gptResponse);
                return gptResponse;
        }

}
