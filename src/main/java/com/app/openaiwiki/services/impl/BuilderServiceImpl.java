package com.app.openaiwiki.services.impl;

import com.app.openaiwiki.chains.BuilderChain;
import com.app.openaiwiki.exceptions.UserException;
import com.app.openaiwiki.parser.Scratchpad;
import com.app.openaiwiki.services.BuilderService;
import com.app.openaiwiki.services.OpenAiClientService;
import com.app.openaiwiki.services.PineconeService;
import com.app.openaiwiki.services.WikiClientService;
import com.app.rxjava.transformer.observable.EdgeChain;
import com.app.rxjava.utils.Atom;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.reactivex.rxjava3.core.Observable;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.util.StopWatch;
import org.springframework.web.multipart.MultipartFile;

import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;
import java.util.stream.IntStream;

@Service
public class BuilderServiceImpl implements BuilderService {

    private final Logger logger = LoggerFactory.getLogger(this.getClass());

    @Autowired private OpenAiClientService openAiClientService;
    @Autowired private WikiClientService wikiClientService;
    @Autowired private PineconeService pineconeService;
    @Autowired private ObjectMapper objectMapper;

    @Override
    public EdgeChain<String> createChatCompletion(String query) {

        /* Any Global Variable Outside Observable must be created with Atom<?> */
        Atom<String> textOutput = Atom.of(""); // Result which we want to emit; initialize with empty string;
        Atom<String> scratchString = Atom.of(""); // Input for OpenAI API
        Atom<Scratchpad> scratchPad = Atom.of(new Scratchpad("")); // Appending & Modifying Wiki-Response;
        Atom<Boolean> terminateWhileLoop = Atom.of(false);

        return new BuilderChain(

                Observable.create(emitter -> {
                    try {
                        // Step 1: Send Request To OpenAI API
                        String responseBody = openAiClientService.createChatCompletionV1(scratchString.get(), query).get();

                        // Step 2: Set the parse JSON response
                        String textOutput_ = textOutput.set(parse(responseBody));

                        // Step 3: Set ScratchPad (TextOutput)
                        scratchPad.set(new Scratchpad(textOutput_));

                        String actionContent = scratchPad.get().getActionContent();
                        System.out.println("Action Content: " + actionContent); // Logging Purpose

                        /* Define While Loop Condition */
                        if (actionContent == null) terminateWhileLoop.set(true);

                        // Step 5: Send Request To Wiki & Modify the response
                        String wikiContent = wikiClientService.getPageContent(actionContent).get();
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
                        System.out.println("Text: " + textOutput_); // Logging Purpose

                        emitter.onComplete();

                    } catch (final Exception e) {
                        emitter.onError(e);
                    }
                })
        ).doWhileLoop(terminateWhileLoop::get);
    }


    @Override
    public BuilderChain extractInformation(MultipartFile file, String query) {

        return new BuilderChain(

                Observable.create(emitter -> {

                    try {
                        // Step 1: Create PDF Document Object
                        PDDocument pdfDocument = PDDocument.load(file.getInputStream());

                        // Step 2: Extract Text From PDF
                        PDFTextStripper textStripper = new PDFTextStripper();
                        String text = textStripper.getText(pdfDocument);
                        pdfDocument.close();

                        // Step 3: Split Extracted Text Into Chunks (Parallel)
                        List<String> chunks = splitToChunksParallel(text, 1000);
                        System.out.println("Chunk Size: " + chunks.size()); // Logging Purpose

                        // (We can parallelize with Observables as well, but Stream API comes with less code)
                        // Step 4: Parallel Iterate Over The Chunks & Generate Embeddings For Each Chunk & Save It In HashMap
                        Map<Integer, List<Double>> embeddingsMap = new HashMap<>();
                        IntStream.range(0, chunks.size()).parallel()
                                .forEach(index -> {
                                    String jsonResponse = openAiClientService.createEmbeddings(chunks.get(index)).get();

                                    // Parse the JSON response to extract the embedding
                                    JsonNode jsonNode = null;
                                    try {
                                        jsonNode = objectMapper.readTree(jsonResponse);
                                    } catch (JsonProcessingException e) {
                                        throw new RuntimeException(e);
                                    }
                                    JsonNode dataArrayNode = jsonNode.get("data");

                                    JsonNode firstDataNode = dataArrayNode.get(0);
                                    JsonNode embeddingNode = firstDataNode.get("embedding");

                                    List<Double> embedding = objectMapper.convertValue(embeddingNode, new TypeReference<>() {});

                                    // Add the embedding to the HashMap with the chunk number as the key
                                    embeddingsMap.put(index, embedding);
                                });

                        // Step 5: Prepare a list of embeddings in the required format (Parallel)
                        List<Map<String, Object>> embeddings = new ArrayList<>();
                        embeddingsMap.entrySet().stream().parallel()
                                .forEach(entry -> {
                                    int chunkId = entry.getKey();
                                    List<Double> embedding = entry.getValue();

                                    Map<String, Object> embeddingMap = new HashMap<>();
                                    embeddingMap.put("id", String.valueOf(chunkId));
                                    embeddingMap.put("values", embedding);

                                    embeddings.add(embeddingMap);
                                });

                        System.out.println("Embeddings Size: "+embeddings.size()); // Logging Purpose

                        // Step 6: UpsertEmbeddings to Pinecone Vector DB (Post Request);
                        pineconeService.upsertEmbeddings(embeddings).await();
                        logger.info("Embeddings Upserted");

                        // =====================================================
                        // Step 7: Generate Word Vectors For Query Text
                        System.out.println("Query: "+query); // Logging Purpose
                        String queryEmbeddingResponse = openAiClientService.createEmbeddings(query).get();
                        // Step 8: Parse & Extract Word Vectors From Response
                        List<Double> wordVectorList = this.extractQueryEmbeddings(queryEmbeddingResponse);

                        System.out.println("Word Vector List Size: "+wordVectorList.size()); // Logging Purpose

                        // Step 9: Perform K-Nearest Neighbor Classification Using Pinecone to perform similarity search
                        String searchResponse = this.pineconeService.searchEmbeddings(wordVectorList, 1).get();

                        String inputContent = null; // Used for OpenAI Request

                        // Step 10:Parse Search JSON Response
                        JsonNode jsonResponse = objectMapper.readTree(searchResponse);

                        JsonNode matchesNode = jsonResponse.get("matches");
                        if (matchesNode.isArray() && matchesNode.size() > 0) {
                            String chunkIdStr = matchesNode.get(0).get("id").asText();
                            System.out.println("Chunk ID: " + chunkIdStr); // Logging Purpose

                            // Parse the chunkId as an integer
                            int chunkId = Integer.parseInt(chunkIdStr);

                            // Access the chunk from the chunks ArrayList using the chunkId
                            if (chunkId >= 0 && chunkId < chunks.size()) inputContent = chunks.get(chunkId); // Save the chunk in the inputContent string
                            else throw new UserException("Invalid Query");
                        }

//                       // Creating For Logging Purpose
                        if(inputContent == null) logger.warn("No input content is found");
                        // ====================================================
                        // Step 11: Using OpenAI API
                        String openAiResponse = this.openAiClientService.createChatCompletionV2(inputContent, query).get();
                        String textOutput = this.parse(openAiResponse);

                        emitter.onNext(textOutput); // Emit Response
                        emitter.onComplete();

                    } catch (final Exception e) {
                        emitter.onError(e);
                    }
                })
        );


    }

    private String parse(String body) throws JsonProcessingException {
        JsonNode outputJsonNode = objectMapper.readTree(body);
        System.out.println("Pretty String: " + outputJsonNode.toPrettyString());

        return outputJsonNode.get("choices").get(0).get("message").get("content").asText();
    }

    private static List<String> splitToChunksParallel(String input, int chunkSize) {
        int noOfChunks = (int) Math.ceil((float) input.length() / chunkSize);

        return IntStream.range(0, noOfChunks).parallel()
                .mapToObj(i -> {
                    int start = i * chunkSize;
                    int end = Math.min((i + 1) * chunkSize, input.length());
                    return input.substring(start, end);
                }).collect(Collectors.toList());
    }

    private List<Double> extractQueryEmbeddings(String response) throws JsonProcessingException {
        JsonNode jsonNode = objectMapper.readTree(response);
        JsonNode dataArrayNode = jsonNode.get("data");
        JsonNode firstDataNode = dataArrayNode.get(0);
        JsonNode embeddingNode = firstDataNode.get("embedding");
       return objectMapper.convertValue(embeddingNode, new TypeReference<>() {});
    }
}
