package com.openai.test;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.sql.SQLOutput;
import java.util.ArrayList;
import java.util.List;

@SpringBootApplication
public class Application {

	 String textoutput = "";

	public static void main(String[] args) throws Exception {

		// Load PDF document from file and extract text
		File file = new File("path/to/your/pdf/file.pdf");
		PDDocument document = PDDocument.load(file);
		PDFTextStripper stripper = new PDFTextStripper();
		String text = stripper.getText(document);
		document.close();

		// Split text into chunks of 1000 characters
		ArrayList<String> chunks = new ArrayList<>();
		int length = text.length();
		for (int i = 0; i < length; i += 1000) {
			int endIndex = Math.min(i + 1000, length);
			String chunk = text.substring(i, endIndex);
			chunks.add(chunk);
		}

		// Generate embeddings
		String openaiApiKey = "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";
		OpenAIEmbeddingCall openaiEmbeddingCall = new OpenAIEmbeddingCall(openaiApiKey);
		String EmbeddingText = "your-text-to-generate-embedding";
		String result = openaiEmbeddingCall.generateEmbedding(text);
		System.out.println(result);



		String UserQuery="What is the collect stage of data maturity?";

		// calling gpt
//		callapi openAIRequest = new callapi();
//		String Docs = "";
//		String qastring = "";
//		String output = openAIRequest.makePostRequest(Docs, qastring);
//		String textoutput = "";
//
//		try {
//			ObjectMapper objectMapper = new ObjectMapper();
//			JsonNode outputJsonNode = objectMapper.readTree(output);
//			textoutput = outputJsonNode.get("choices").get(0).get("message").get("content").asText();
//			System.out.println(textoutput);
//			System.out.println();
//			System.out.println();
//		} catch (Exception e) {
//			e.printStackTrace();
//		}
//
//		System.out.println(textoutput);
	}
}