package com.edgechain.lib.embeddings.services;

import com.edgechain.lib.embeddings.request.Doc2VecRequest;
import org.deeplearning4j.models.embeddings.loader.WordVectorSerializer;
import org.deeplearning4j.models.paragraphvectors.ParagraphVectors;
import org.deeplearning4j.text.documentiterator.LabelledDocument;
import org.deeplearning4j.text.documentiterator.SimpleLabelAwareIterator;
import org.deeplearning4j.text.sentenceiterator.BasicLineIterator;
import org.deeplearning4j.text.sentenceiterator.FileSentenceIterator;
import org.deeplearning4j.text.sentenceiterator.SentenceIterator;
import org.deeplearning4j.text.tokenization.tokenizer.preprocessor.CommonPreprocessor;
import org.deeplearning4j.text.tokenization.tokenizerfactory.DefaultTokenizerFactory;
import org.deeplearning4j.text.tokenization.tokenizerfactory.TokenizerFactory;

import java.io.*;
import java.util.ArrayList;
import java.util.List;

public class Doc2VecBuilder {

  private final Doc2VecRequest doc2VecRequest;

  public Doc2VecBuilder(Doc2VecRequest doc2VecRequest) {
    this.doc2VecRequest = doc2VecRequest;
  }

  public void train(InputStream inputStream) throws IOException {
    SentenceIterator iter = new BasicLineIterator(inputStream);
    this.paragraphVectorBuilder(iter);
  }

  public void train(File directory) {
    SentenceIterator iter = new FileSentenceIterator(directory);
    this.paragraphVectorBuilder(iter);
  }

  private void paragraphVectorBuilder(SentenceIterator iter) {

    List<LabelledDocument> docs = new ArrayList<>();
    long offset = 0L;

    while (iter.hasNext()) {
      LabelledDocument doc = new LabelledDocument();
      doc.setContent(iter.nextSentence());
      doc.addLabel("embedding-" + offset);
      docs.add(doc);
      offset = offset + 1;
    }

    TokenizerFactory tokenizer = new DefaultTokenizerFactory();
    tokenizer.setTokenPreProcessor(new CommonPreprocessor());

    SimpleLabelAwareIterator iterator = new SimpleLabelAwareIterator(docs);

    ParagraphVectors vectors =
        new ParagraphVectors.Builder()
            .minWordFrequency(this.doc2VecRequest.getMinWordFrequency())
            .iterations(this.doc2VecRequest.getIteration())
            .epochs(this.doc2VecRequest.getEpochs())
            .layerSize(this.doc2VecRequest.getLayerSize())
            .learningRate(this.doc2VecRequest.getLearningRate())
            .windowSize(this.doc2VecRequest.getWindowSize())
            .batchSize(this.doc2VecRequest.getBatchSize())
            .iterate(iterator)
            .trainWordVectors(true)
            .sampling(this.doc2VecRequest.getSampling())
            .tokenizerFactory(tokenizer)
            .build();

    vectors.fit();

    WordVectorSerializer.writeParagraphVectors(
        vectors,
        doc2VecRequest.getDestination() + File.separator + doc2VecRequest.getModelName() + ".bin");
  }
}
