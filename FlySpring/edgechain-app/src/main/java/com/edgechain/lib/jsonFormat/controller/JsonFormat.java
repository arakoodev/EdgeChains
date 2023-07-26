package com.edgechain.lib.jsonFormat.controller;

import java.util.concurrent.TimeUnit;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.edgechain.lib.constants.EndpointConstants;
import com.edgechain.lib.endpoint.impl.OpenAiEndpoint;
import com.edgechain.lib.jsonFormat.dto.UserPromptRequest;
import com.edgechain.lib.rxjava.retry.impl.ExponentialDelay;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import io.reactivex.rxjava3.core.Single;

@RestController
@RequestMapping("/json")
public class JsonFormat {

    private final String OPENAI_AUTH_KEY ="";

    @GetMapping("/extract")
    public Single<String> extract(@RequestBody UserPromptRequest UserPromptRequest) {
        String rePrompt = "INPUT = " + UserPromptRequest.getPrompt() + " EXTRACTED = " + UserPromptRequest.getFormat()
                + " Return EXTRACTED as a valid JSON object.";
        System.out.println(rePrompt);

        OpenAiEndpoint userChat = new OpenAiEndpoint(
                EndpointConstants.OPENAI_CHAT_COMPLETION_API,
                OPENAI_AUTH_KEY,
                "gpt-3.5-turbo",
                "user",
                0.7,
                new ExponentialDelay(3, 5, 2, TimeUnit.SECONDS));

        String gptResponse = userChat.getChatCompletion(rePrompt).blockingFirst().getChoices().get(0).getMessage()
                .getContent();

        if (gptResponse == null) {
            System.out.println("ChatGptResponse is null. There was an error processing the request.");
            return  Single.just("ChatGptResponse is null. There was an error processing the request.");
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


    // @GetMapping("/situation")
    // public String handleSituation() {

    //     String situation = """
    //             Let's play poker. Your name is Tommy and you are a player in a game of No-Limit Texas Hold'em Poker.
    //             You have the cards Ac, Ah. The board is []. You have $100 in your stack.
    //             The pot is $20. You need to put $3 into the pot to play.
    //             The current bet is $3, and you are in seat 9 out of 9.
    //             Your position is in the Cutoff.
    //                     """;

    //     String validAction = """
    //             You can call for $5, raise between $6 and $100, or fold for $0
    //                     """;

    //     String callToAction = """
    //             What is the action you would like to take out of the following: ('call', 'raise', 'fold')?
    //                     """;

    //     String actionFormat = """
    //             Specify the amount associated with that action in the format:
    //             {
    //                 action: {
    //                     reason: string,
    //                     type: string
    //                 }
    //                 amount: number
    //             } Only return values in this format (no other text is necessary)
    //                     """;

    //     String getActionPrompt = "This is the situation: " + situation + " These are the set of valid actions to take: "
    //             + validAction + " " + callToAction;

    //     OpenAiEndpoint userChat = new OpenAiEndpoint(
    //             EndpointConstants.OPENAI_CHAT_COMPLETION_API,
    //             OPENAI_AUTH_KEY,
    //             "gpt-3.5-turbo",
    //             "user",
    //             0.7,
    //             new ExponentialDelay(3, 5, 2, TimeUnit.SECONDS));
        
    //     String gptResponse = userChat.getChatCompletion(rePrompt).blockingFirst().getChoices().get(0).getMessage()
    //             .getContent();

    //     ChatGptResponse chatGptResponse = template.postForObject(apiURL, request, ChatGptResponse.class);
    //     String response1 = chatGptResponse.getChoices().get(0).getMessage().getContent();
    //     System.out.println("response1: " + response1);

    //     String validActionCheckPrompt = "Given the situation: " + situation + " And the action you chose: " + response1
    //             + " Is the action you in this set of valid actions: " + validAction
    //             + "? If not, choose the best valid action to take. If so, please return the original action";

    //     ChatGPTRequest request2 = new ChatGPTRequest(model, validActionCheckPrompt);
    //     ChatGptResponse chatGptResponse2 = template.postForObject(apiURL, request2, ChatGptResponse.class);
    //     String response2 = chatGptResponse2.getChoices().get(0).getMessage().getContent();
    //     System.out.println("response2: " + response2);

    //     String getActionFormat = "This is the correct format for an action: " + actionFormat
    //             + " This is the chosen action: " + response2 + " Convert the chosen action to the correct format.";

    //     ChatGPTRequest request3 = new ChatGPTRequest(model, getActionFormat);
    //     ChatGptResponse chatGptResponse3 = template.postForObject(apiURL, request3, ChatGptResponse.class);
    //     String response3 = chatGptResponse3.getChoices().get(0).getMessage().getContent();
    //     System.out.println("response3: " + response3);

    //     try {
    //         ObjectMapper objectMapper = new ObjectMapper();
    //         JsonNode jsonNode = objectMapper.readTree(response3);
    //         System.out.println("The response is a valid JSON string." + jsonNode);
    //         return response3;
    //     } catch (Exception e) {
    //         System.out.println("The response is not a valid JSON string so retrying.");
    //         String getValidFormat = "This is the correct format for an action: " + actionFormat
    //                 + " This is a formatted action: " + response3 + " Return the action in the correct format.";
    //         ChatGPTRequest request4 = new ChatGPTRequest(model, getValidFormat);
    //         ChatGptResponse chatGptResponse4 = template.postForObject(apiURL, request4, ChatGptResponse.class);
    //         String response4 = chatGptResponse4.getChoices().get(0).getMessage().getContent();
    //         System.out.println("Final Response: " + response4);
    //         return response4;
    //     }

    // }
    
    
}
