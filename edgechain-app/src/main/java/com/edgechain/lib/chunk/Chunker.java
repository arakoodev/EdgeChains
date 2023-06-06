package com.edgechain.lib.chunk;

import java.util.stream.IntStream;

public class Chunker {

    public String[] byChunkSize(String input, int chunkSize) {

        int noOfChunks = (int) Math.ceil((float) input.length() / chunkSize);

        return IntStream.range(0, noOfChunks)
                .parallel()
                .mapToObj(
                        i -> {
                            int start = i * chunkSize;
                            int end = Math.min((i + 1) * chunkSize, input.length());
                            return input.substring(start, end).strip();
                        })
                .toArray(String[]::new);
    }

//    public String[] bySentence(String input) {
//
//        StanfordCoreNLP stanfordCoreNLP = Pipeline.getPipeline();
//
//        CoreDocument coreDocument = new CoreDocument(input);
//
//        stanfordCoreNLP.annotate(coreDocument);
//
//        List<CoreSentence> sentences = coreDocument.sentences();
//
//        return sentences.stream().parallel().map(CoreSentence::text).toArray(String[]::new);
//    }
//
//
//    public String[] bySentence(String input, int limit) {
//
//        StanfordCoreNLP stanfordCoreNLP = Pipeline.getPipeline();
//
//        CoreDocument coreDocument = new CoreDocument(input);
//
//        stanfordCoreNLP.annotate(coreDocument);
//
//        List<CoreSentence> sentences = coreDocument.sentences();
//
//        return sentences.stream().parallel().map(c -> c.text().length() > limit ? c.text().substring(0, limit) : c.text() ).toArray(String[]::new);
//    }

}
