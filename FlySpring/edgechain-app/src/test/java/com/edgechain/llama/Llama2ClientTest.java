package com.edgechain.llama;

import com.edgechain.lib.llama2.request.Llama2ChatCompletionRequest;
import org.json.JSONObject;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.List;

@SpringBootTest
public class Llama2ClientTest {

    Logger logger = LoggerFactory.getLogger(getClass());

    @Test
    @DisplayName("Test LLamaClient - Request Format")
    void TestLLamaClient_LLamaRequest_ShouldMatchFormat() {

        Llama2ChatCompletionRequest llama2ChatCompletionRequest = Llama2ChatCompletionRequest.builder()
                .inputs("<s>[INST]<<SYS>>What is the color of sky?<</SYS>>")
                .parameters(getJsonObject())
                .build();

        logger.info("llama completion request data {} ", llama2ChatCompletionRequest);


        String result = String.valueOf(new JSONObject(llama2ChatCompletionRequest));
        String expected = getRequestBody();

        Assertions.assertEquals(expected, result);
    }
    private static JSONObject getJsonObject() {
        JSONObject parameters = new JSONObject();
        parameters.put("do_sample", true);
        parameters.put("top_p", 50);
        parameters.put("temperature", 0.7);
        parameters.put("top_k", 2);
        parameters.put("max_new_tokens", 512);
        parameters.put("repetition_penalty", 0.6);
        parameters.put("stop", List.of("</s>"));
        return parameters;
    }

    private static String getRequestBody(){
        return "{\"inputs\":\"<s>[INST]<<SYS>>What is the color of sky?<<\\/SYS>>\"," +
                "\"parameters\":{\"top_p\":50,\"stop\":[\"<\\/s>\"],\"max_new_tokens\":512," +
                "\"top_k\":2,\"temperature\":0.7,\"do_sample\":true,\"repetition_penalty\":0.6}}";
    }
}