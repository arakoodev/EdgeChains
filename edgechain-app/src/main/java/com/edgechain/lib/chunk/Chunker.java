package com.edgechain.lib.chunk;

import com.edgechain.lib.constants.LibConstants;
import opennlp.tools.sentdetect.SentenceDetectorME;
import opennlp.tools.sentdetect.SentenceModel;

import java.io.IOException;
import java.io.InputStream;
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

    public String[] bySentence(String input)  {

        SentenceModel model = null;
        try {
            model = new SentenceModel(LibConstants.sentenceModel);
        } catch (IOException e) {
            throw new RuntimeException(e);
        }
        SentenceDetectorME sdetector = new SentenceDetectorME(model);

        // detect sentences in the paragraph
        return sdetector.sentDetect(input);
    }


}
