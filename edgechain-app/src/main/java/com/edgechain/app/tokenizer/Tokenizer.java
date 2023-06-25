package com.edgechain.app.tokenizer;

import ai.djl.huggingface.tokenizers.Encoding;
import ai.djl.huggingface.tokenizers.HuggingFaceTokenizer;
import java.io.IOException;
import java.net.URI;
import java.nio.file.Paths;

public class Tokenizer {

  /*
   * Class for Tokenization and encoding
   * */
  private Encoding encoding;
  private final HuggingFaceTokenizer tokenizer;

  public Tokenizer(String tokenizerJsonPath) throws IOException {
    /*
     * Initialize tokenizer
     */
    tokenizer = HuggingFaceTokenizer.newInstance(Paths.get(tokenizerJsonPath));
  }

  public Tokenizer(URI uri) throws IOException {
    /*
     * Initialize tokenizer
     */
    tokenizer = HuggingFaceTokenizer.newInstance(Paths.get(uri));
  }

  public void encode(String inputText) {
    /*
     * Encode Text
     * */
    encoding = tokenizer.encode(inputText);
  }

  public String decode(long[] inputText) {
    /*
     * Encode Text
     * */
    return tokenizer.decode(inputText);
  }

  //    public String decode(float ids) {
  //        /*
  //         * Encode Text
  //         * */
  //        return tokenizer.decode([], true);
  //        //return decoding;
  //    }

  public long[] getIds() {
    /*
     * get Ids from encoded tokens
     * */
    return encoding.getIds();
  }

  public boolean[] convertIntArrayToBooleanArray(long[] inputArray) {
    boolean[] booleanArray = new boolean[inputArray.length];

    for (int i = 0; i < inputArray.length; i++) {
      booleanArray[i] = inputArray[i] == 1;
    }

    return booleanArray;
  }

  public long[] getAttentionMask() {
    /*
     * get Attention mask from encodings
     * */
    return encoding.getAttentionMask();
  }

  public String[] getTokens() {
    /*
     * get tokens from encodings
     * */

    return encoding.getTokens();
  }
}
