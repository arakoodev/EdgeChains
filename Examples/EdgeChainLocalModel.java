package com.edgechain.app;

import ai.onnxruntime.OnnxTensor;
import ai.onnxruntime.OrtEnvironment;
import ai.onnxruntime.OrtException;
import ai.onnxruntime.OrtSession;
import com.edgechain.app.constants.WebConstants;
import com.edgechain.app.tokenizer.Tokenizer;
import com.edgechain.lib.configuration.EdgeChainAutoConfiguration;
import com.edgechain.service.constants.ServiceConstants;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.net.URL;
import java.util.Map;
import org.deeplearning4j.models.embeddings.loader.WordVectorSerializer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.ImportAutoConfiguration;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.openfeign.FeignAutoConfiguration;
import org.springframework.context.annotation.Import;

@SpringBootApplication(scanBasePackages = {"com.edgechain.app", "com.edgechain.service"})
@ImportAutoConfiguration({FeignAutoConfiguration.class})
@Import(EdgeChainAutoConfiguration.class)
public class EdgeChainLocalModel {

  private static final Logger logger = LoggerFactory.getLogger(EdgeChainLocalModel.class);

  static long[] inputIds;
  static long[] inputAttentionMask;
  static Tokenizer tokenizer;

  static int sequence = 2048;

  public static boolean[] addElementsToArray(boolean[] array, int numElements) {
    boolean[] newArray = new boolean[array.length + numElements];

    // Copy existing elements to the new array
    System.arraycopy(array, 0, newArray, 0, array.length);

    // Add additional elements
    for (int i = array.length; i < newArray.length; i++) {
      newArray[i] = false; // Example: Adding consecutive numbers
    }

    return newArray;
  }

  public static long[] addElementsToArrays(long[] array, int numElements) {
    long[] newArray = new long[array.length + numElements];

    // Copy existing elements to the new array
    System.arraycopy(array, 0, newArray, 0, array.length);

    // Add additional elements
    for (int i = array.length; i < newArray.length; i++) {
      newArray[i] = 1; // Example: Adding consecutive numbers
    }

    return newArray;
  }

  public static int argmax(float[] array) {
    int maxIndex = 0;
    float maxValue = array[0];

    for (int i = 1; i < array.length; i++) {
      if (array[i] > maxValue) {
        maxValue = array[i];
        maxIndex = i;
      }
    }
    return maxIndex;
  }

  public static void main(String[] args) throws Exception {

    System.setProperty("server.port", "8002");

    System.setProperty("OPENAI_AUTH_KEY", "");

    System.setProperty("PINECONE_AUTH_KEY", "");
    System.setProperty("PINECONE_QUERY_API", "");
    System.setProperty("PINECONE_UPSERT_API", "");
    System.setProperty("PINECONE_DELETE_API", "");

    System.setProperty("spring.data.redis.host", "");
    System.setProperty("spring.data.redis.port", "6379");
    System.setProperty("spring.data.redis.username", "default");
    System.setProperty("spring.data.redis.password", "");
    System.setProperty("spring.data.redis.connect-timeout", "120000");
    System.setProperty("spring.redis.ttl", "3600");

    System.setProperty("doc2vec.filepath", "R:\\doc_vector.bin");
    readDoc2Vec();
    loadSentenceModel();
    
    try {
      /*
       * Creating ONNX environment and session
       * */
      OrtEnvironment env = OrtEnvironment.getEnvironment();
      String model_path = "raw-files/mpt_7b_onnx/model.onnx";
      // create an onnx-runtime session
      OrtSession session = env.createSession(model_path);

      /*
       * input and output layers Info
       * */
      System.out.printf(
          "Model Input Names:  %s\nModel Input info:  %s\n"
              + "Model Output Names:  %s\nModel Output info:  %s",
          session.getInputNames(),
          session.getInputInfo(),
          session.getOutputNames(),
          session.getOutputInfo());

      /*
       * Encode Text and convert to OnnxTensor
       * */

      // Encode Text
      try {
        Tokenizer tokenizer = new Tokenizer("R:\\tokenizer.json");
        tokenizer.encode("python function that reads a file, and shows its content");
        System.out.println("File loaded...");
      } catch (IOException ioException) {
        ioException.printStackTrace();
      }

      /*
       * Calculate Inputs
       * then convert them to OnnxTensor
       * */

      // get Input Ids and Attention Mask
      inputIds = tokenizer.getIds(); // get Input Ids
      inputAttentionMask = tokenizer.getAttentionMask(); // get Attention mask
      boolean[] booleanAttentionMask =
          tokenizer.convertIntArrayToBooleanArray(
              inputAttentionMask); // change type from integer to boolean
      booleanAttentionMask =
          addElementsToArray(booleanAttentionMask, sequence - inputAttentionMask.length);
      inputIds = addElementsToArrays(inputIds, sequence - inputIds.length);

      // modify Encoded Ids according to the model requirement
      // from [input_ids] to [[input_ids]]
      long[][] newInputIds = new long[1][inputIds.length];
      System.arraycopy(inputIds, 0, newInputIds[0], 0, inputIds.length);

      // modify Attention Mask according to the model requirement
      // from [attention_mask] to [[attention_mask]]
      boolean[][] newAttentionMask = new boolean[1][booleanAttentionMask.length];
      System.arraycopy(
          booleanAttentionMask, 0, newAttentionMask[0], 0, booleanAttentionMask.length);

      // create OnnxTensor
      OnnxTensor idsTensor = OnnxTensor.createTensor(env, newInputIds);
      OnnxTensor maskTensor = OnnxTensor.createTensor(env, newAttentionMask);

      // map input Tensor according to model Input
      // key is layer name, and value is value you want to pass
      var model_inputs = Map.of("input_ids", idsTensor, "attention_mask", maskTensor);

      /*
       * Running the inference on the model
       * */
      OrtSession.Result result = session.run(model_inputs);

      /*
       * Handling the inference output
       * */
      // get output results
      float[][][] logits = (float[][][]) result.get(0).getValue();

      /*
       * Showing the results
       * */

      long[] list = new long[sequence];
      for (int i = 0; i < logits[0].length; i++) {

        list[i] = argmax(logits[0][i]);
      }
      //            System.out.println(tokenizer.decode(list));
      System.out.println(tokenizer.decode(list));

    } catch (OrtException e) {
      e.printStackTrace();
    }

    SpringApplication.run(EdgeChainLocalModel.class, args);
  }

  private static void loadSentenceModel() {
    WebConstants.sentenceModel = EdgeChainLocalModel.class.getResourceAsStream("/en-sent.zip");
  }

  private static void readDoc2Vec() throws Exception {

    String modelPath = System.getProperty("doc2vec.filepath");

    File file = new File(modelPath);

    if (!file.exists()) {
      logger.warn(
          "It seems like, you haven't trained the model or correctly specified Doc2Vec model"
              + " path.");
    } else {
      logger.info("Loading...");
      ServiceConstants.embeddingDoc2VecModel =
          WordVectorSerializer.readParagraphVectors(new FileInputStream(modelPath));
      logger.info("Doc2Vec model is successfully loaded...");
    }
  }
}
