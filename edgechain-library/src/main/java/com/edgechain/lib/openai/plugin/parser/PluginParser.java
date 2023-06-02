package com.edgechain.lib.openai.plugin.parser;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.ArrayList;
import java.util.List;
import java.util.StringTokenizer;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class PluginParser {

    private final String action;
    private final String observation;

    private PluginParser(String action, String observation) {
        this.action = action;
        this.observation = observation;
    }

    public static String parse(String nameForModel, String openAPISpec) {
        return new PluginParser("Action: " + nameForModel, "Observation: " + openAPISpec).toString();
    }

    public static List<String> extractUrls(String response) {

        List<String> urlList = new ArrayList<>();

        StringTokenizer tokenizer = new StringTokenizer(parseOpenAPIResponse(response), "\n");

        while (tokenizer.hasMoreTokens()) {

            String token = tokenizer.nextToken();

            if (token.startsWith("Action Input: ")) {

                String regex
                        = "\\b((?:https?|ftp|file):"
                        + "//[-a-zA-Z0-9+&@#/%?="
                        + "~_|!:, .;]*[-a-zA-Z0-9+"
                        + "&@#/%=~_|])";

                // Compile the Regular Expression
                Pattern p = Pattern.compile(regex, Pattern.CASE_INSENSITIVE);

                Matcher m = p.matcher(token);
                while (m.find()) {
                    urlList.add(token.substring(m.start(0), m.end(0)));
                }

            }
        }

        return urlList;
    }


    public static String getFinalAnswer(String response) {
        // Initializing Variables;
        String finalAnswer = null;
        StringTokenizer tokenizer = new StringTokenizer(parseOpenAPIResponse(response), "\n");
        while (tokenizer.hasMoreTokens()) {
            String token = tokenizer.nextToken();
            if (token.startsWith("Final Answer: ")) {
                finalAnswer = token;
                break;
            }
        }

        return finalAnswer;
    }


    @Override
    public String toString() {
        return action + "\n" + observation;
    }


    private static String parseOpenAPIResponse(String body) {
        ObjectMapper objectMapper = new ObjectMapper();
        JsonNode outputJsonNode = null;
        try {
            outputJsonNode = objectMapper.readTree(body);
        } catch (JsonProcessingException e) {
            throw new RuntimeException(e);
        }
        System.out.println("Pretty String: " + outputJsonNode.toPrettyString());
        return outputJsonNode.get("choices").get(0).get("text").asText();
    }

}
