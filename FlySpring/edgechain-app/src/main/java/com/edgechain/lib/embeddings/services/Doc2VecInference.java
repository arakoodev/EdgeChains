package com.edgechain.lib.embeddings.services;

import org.apache.commons.lang.ArrayUtils;
import org.deeplearning4j.models.paragraphvectors.ParagraphVectors;
import org.deeplearning4j.text.tokenization.tokenizer.preprocessor.CommonPreprocessor;
import org.deeplearning4j.text.tokenization.tokenizerfactory.DefaultTokenizerFactory;
import org.deeplearning4j.text.tokenization.tokenizerfactory.TokenizerFactory;
import org.nd4j.linalg.api.ndarray.INDArray;

import java.util.Arrays;
import java.util.List;

public class Doc2VecInference {

  private final ParagraphVectors paragraphVectors;
  private final String input;

  public Doc2VecInference(ParagraphVectors paragraphVectors, String input) {
    this.paragraphVectors = paragraphVectors;
    this.input = input;
  }

  public List<Float> inferVectors() {

    TokenizerFactory t = new DefaultTokenizerFactory();
    t.setTokenPreProcessor(new CommonPreprocessor());

    paragraphVectors.setTokenizerFactory(t);
    INDArray indArray = paragraphVectors.inferVector(input);

    Float[] floatArray = ArrayUtils.toObject(indArray.toFloatVector());
    return Arrays.asList(floatArray);
  }
}
