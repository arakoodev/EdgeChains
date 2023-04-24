package com.openai.test;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import org.apache.commons.io.FileUtils;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.File;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@SpringBootApplication
public class Application {

	public static void main(String[] args) throws Exception {

		String apiKey = "2709ba96-d47e-4bb8-b39d-02977e458cf9";
		String indexName = "index";
		PineconeRestAPI pineconeApi = new PineconeRestAPI(apiKey, indexName);
		OpenAIEmbeddingCall openAIEmbeddingCall = new OpenAIEmbeddingCall();
		ObjectMapper objectMapper = new ObjectMapper();

//		 Load PDF document from file and extract text
		File file = new File("C:\\Users\\rohan\\Desktop\\field-guide-to-data-science.pdf");
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

		// Iterate over the chunks, generate embeddings for each chunk, and save them in a HashMap
		Map<Integer, List<Double>> embeddingsMap = new HashMap<>();
		for (int i = 0; i < chunks.size(); i++) {
			String chunk = chunks.get(i);
			String jsonResponse = openAIEmbeddingCall.generateEmbedding(chunk);

			// Parse the JSON response to extract the embedding
			JsonNode jsonNode = objectMapper.readTree(jsonResponse);
			JsonNode dataArrayNode = jsonNode.get("data");
			JsonNode firstDataNode = dataArrayNode.get(0);
			JsonNode embeddingNode = firstDataNode.get("embedding");

			List<Double> embedding = objectMapper.convertValue(embeddingNode, new TypeReference<List<Double>>() {});

			// Add the embedding to the HashMap with the chunk number as the key
			embeddingsMap.put(i, embedding);
		}
		System.out.println(embeddingsMap);


//      for testing pinecone api with local embeddings
//		File file = new File("embeddings.txt");
//		String json = FileUtils.readFileToString(file, "UTF-8");
//
//		// Parse the JSON data into a HashMap object
//		ObjectMapper objectMapper = new ObjectMapper();
//		TypeReference<HashMap<Integer, List<Double>>> typeRef = new TypeReference<HashMap<Integer, List<Double>>>() {
//		};
//		HashMap<Integer, List<Double>> embeddingsMap = objectMapper.readValue(json, typeRef);




		// Prepare a list of embeddings in the required format
		List<Map<String, Object>> embeddings = new ArrayList<>();
		for (Map.Entry<Integer, List<Double>> entry : embeddingsMap.entrySet()) {
			int chunkId = entry.getKey();
			List<Double> embedding = entry.getValue();

			Map<String, Object> embeddingMap = new HashMap<>();
			embeddingMap.put("id", String.valueOf(chunkId));
			embeddingMap.put("values", embedding);

			embeddings.add(embeddingMap);
		}

//		 Call the upsertEmbeddings method to send the list of embeddings to Pinecone REST API
		String jsonResponse = pineconeApi.upsertEmbeddings(embeddings);
		System.out.println(jsonResponse);


		String queryText = "What is the collect stage of data maturity?";
		String queryEmbeddingJsonResponse = openAIEmbeddingCall.generateEmbedding(queryText);
		JsonNode jsonNode = objectMapper.readTree(queryEmbeddingJsonResponse);
		JsonNode dataArrayNode = jsonNode.get("data");
		JsonNode firstDataNode = dataArrayNode.get(0);
		JsonNode embeddingNode = firstDataNode.get("embedding");
		List<Double> queryEmbedding = objectMapper.convertValue(embeddingNode, new TypeReference<List<Double>>() {});

		System.out.println(queryEmbedding);

//		// Read the queryEmbedding string from the text file
//		String queryEmbeddingFilename = "query_embedding.txt";
//		String queryEmbeddingStr = FileUtils.readFileToString(new File(queryEmbeddingFilename), StandardCharsets.UTF_8);

// Convert the queryEmbedding string back to a list of doubles
//		queryEmbeddingStr = queryEmbeddingStr.substring(1, queryEmbeddingStr.length() - 1); // Remove the brackets
//		List<Double> savedQueryEmbedding = Stream.of(queryEmbeddingStr.split(","))
//				.map(String::trim)
//				.map(Double::parseDouble)
//				.collect(Collectors.toList());

		// Call the searchEmbedding method to perform a similarity search in Pinecone
		int topK = 1; // Number of nearest neighbors to return
		String searchResponse = pineconeApi.searchEmbedding(queryEmbedding, topK);
		System.out.println(searchResponse);

		// Parse the JSON response to extract the nearest neighbor
		JsonNode jsonResponse1 = objectMapper.readTree(searchResponse);

		String inputContent = null; // Declare the inputContent string

// Extract the 'id' field of the first match (if any)
		JsonNode matchesNode = jsonResponse1.get("matches");
		if (matchesNode.isArray() && matchesNode.size() > 0) {
			String chunkIdStr = matchesNode.get(0).get("id").asText();
			System.out.println("Chunk ID: " + chunkIdStr);

			// Parse the chunkId as an integer
			int chunkId = Integer.parseInt(chunkIdStr);

			// Access the chunk from the chunks ArrayList using the chunkId
			if (chunkId >= 0 && chunkId < chunks.size()) {
				String chunk = chunks.get(chunkId);
//				System.out.println("Chunk content: " + chunk);

				// Save the chunk in the inputContent string
				inputContent = chunk;
			} else {
//				System.out.println("Invalid chunkId: " + chunkId);
			}
		}

// Now the inputContent variable holds the specific chunk
		if (inputContent != null) {
			System.out.println("Input content: " + inputContent);
		} else {
			System.out.println("No input content found.");
		}



		// calling gpt
		callapi openAIRequest = new callapi();
		String qastring = "Question: What is the collect stage of data maturity?\n" +
				"Helpful Answer:\n";
		String output = openAIRequest.makePostRequest(inputContent, qastring);
		String textoutput ="";

		try {
			JsonNode outputJsonNode = objectMapper.readTree(output);
			textoutput = outputJsonNode.get("choices").get(0).get("message").get("content").asText();
			System.out.println(textoutput);
			System.out.println();
			System.out.println();
		} catch (Exception e) {
			e.printStackTrace();
		}


	System.out.println(textoutput);
	}
}
