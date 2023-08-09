package com.edgechain;

import java.util.concurrent.TimeUnit;

import org.json.JSONException;
import org.json.JSONObject;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.edgechain.lib.codeInterpreter.Eval;
import com.edgechain.lib.endpoint.impl.OpenAiEndpoint;
import com.edgechain.lib.request.ArkRequest;
import com.edgechain.lib.rxjava.retry.impl.ExponentialDelay;

import static com.edgechain.lib.constants.EndpointConstants.OPENAI_CHAT_COMPLETION_API;

@SpringBootApplication
public class CodeInterpreter {

    private static final String OPENAI_AUTH_KEY = "";
    private static OpenAiEndpoint userChatEndpoint;

    public static void main(String[] args) {
        System.setProperty("server.port", "8080");
        new SpringApplicationBuilder(CodeInterpreter.class).run(args);
    }

    @RestController
    @RequestMapping()
    public class interpreter {

        @GetMapping("/")
        public double interpret(ArkRequest arkRequest) throws JSONException {

            JSONObject json = arkRequest.getBody();

            userChatEndpoint = new OpenAiEndpoint(
                    OPENAI_CHAT_COMPLETION_API,
                    OPENAI_AUTH_KEY,
                    "gpt-3.5-turbo",
                    "user",
                    0.7,
                    new ExponentialDelay(3, 5, 2, TimeUnit.SECONDS));

            String response = userChatEndpoint
                    .chatCompletion(json.getString("code"), "Json-format", arkRequest)
                    .blockingFirst()
                    .getChoices()
                    .get(0)
                    .getMessage()
                    .getContent();

            System.out.println(response + " from chatgpt3");
            System.out.println(Eval.evaluateExpression(json.getString("code")) + " from Eval");

            return Eval.evaluateExpression(json.getString("code"));

        }

    }

}
