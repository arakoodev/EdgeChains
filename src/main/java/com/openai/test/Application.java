package com.openai.test;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.List;

@SpringBootApplication
public class Application {

	private static String textoutput = "";

	public static void main(String[] args) throws JsonProcessingException {
		callapi openAIRequest = new callapi();
		String input = "";
		String output = openAIRequest.makePostRequest(input);

		try {
			ObjectMapper objectMapper = new ObjectMapper();
			JsonNode outputJsonNode = objectMapper.readTree(output);
			textoutput = outputJsonNode.get("choices").get(0).get("message").get("content").asText();
			System.out.println(textoutput);
			System.out.println();
			System.out.println();
		} catch (Exception e) {
			e.printStackTrace();
		}

		Scratchpad scratchpad = new Scratchpad(textoutput);
		List<String> outputList = scratchpad.getScratchpadList();

		String scratchString = "";

		String searchContent;
		while ((searchContent = scratchpad.getActionContent()) != null) {
			System.out.println("Content to Search: " + searchContent);
			WikiApiClient wikiApiClient = new WikiApiClient();
			String wikiContent = wikiApiClient.getPageContent(searchContent);
			System.out.println(wikiContent);
			System.out.println();
			scratchpad.observationReplacer(wikiContent);
			for (String test : outputList) {
				System.out.println(test);
			}

			StringBuilder scratchStringBuilder = new StringBuilder(scratchString);
			for (String line : outputList) {
				scratchStringBuilder.append(line).append("\n");
			}
			scratchString = scratchStringBuilder.toString();

			System.out.println("ScratchString :");
			System.out.println(scratchString);

//			StringBuilder modifiedOutput = new StringBuilder();
//			for (String line : outputList) {
//				modifiedOutput.append(line).append("\n");
//			}

			// Call openAIRequest.makePostRequest with the modified outputList
			String newOutput = openAIRequest.makePostRequest(scratchString);
		//	System.out.println(newOutput);
			try {
				ObjectMapper objectMapper = new ObjectMapper();
				JsonNode outputJsonNode = objectMapper.readTree(newOutput);
				textoutput = outputJsonNode.get("choices").get(0).get("message").get("content").asText();
				System.out.println(textoutput);
				System.out.println();
				System.out.println();
			} catch (Exception e) {
				e.printStackTrace();
			}

			scratchpad = new Scratchpad(textoutput);
			outputList = scratchpad.getScratchpadList();
		}
	}
}