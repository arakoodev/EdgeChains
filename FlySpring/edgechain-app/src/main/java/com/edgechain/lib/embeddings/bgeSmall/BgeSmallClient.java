package com.edgechain.lib.embeddings.bgeSmall;

import ai.djl.MalformedModelException;
import ai.djl.huggingface.tokenizers.Encoding;
import ai.djl.huggingface.tokenizers.HuggingFaceTokenizer;
import ai.djl.inference.Predictor;
import ai.djl.ndarray.NDArray;
import ai.djl.ndarray.NDList;
import ai.djl.ndarray.NDManager;
import ai.djl.ndarray.types.DataType;
import ai.djl.repository.zoo.Criteria;
import ai.djl.repository.zoo.ModelNotFoundException;
import ai.djl.repository.zoo.ZooModel;
import ai.djl.training.util.ProgressBar;
import ai.djl.translate.Batchifier;
import ai.djl.translate.Translator;
import ai.djl.translate.TranslatorContext;
import com.edgechain.lib.embeddings.bgeSmall.response.BgeSmallResponse;
import com.edgechain.lib.endpoint.impl.embeddings.BgeSmallEndpoint;
import com.edgechain.lib.rxjava.transformer.observable.EdgeChain;
import io.reactivex.rxjava3.core.Observable;
import java.io.IOException;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.LinkedList;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class BgeSmallClient {

  private static volatile ZooModel<String, float[]> bgeSmallEn;

  public EdgeChain<BgeSmallResponse> createEmbeddings(String input, BgeSmallEndpoint endpoint) {

    return new EdgeChain<>(
        Observable.create(
            emitter -> {
              try {
                Predictor<String, float[]> predictor = loadSmallBgeEn().newPredictor();
                float[] predict = predictor.predict(input);
                List<Float> floatList = new LinkedList<>();
                for (float v : predict) {
                  floatList.add(v);
                }

                emitter.onNext(new BgeSmallResponse(floatList));
                emitter.onComplete();
              } catch (final Exception e) {
                emitter.onError(e);
              }
            }),
        endpoint);
  }

  private ZooModel<String, float[]> loadSmallBgeEn() throws IOException {

    ZooModel<String, float[]> r = bgeSmallEn;

    if (r == null) {
      final Logger logger = LoggerFactory.getLogger(BgeSmallEndpoint.class);
      synchronized (this) {
        r = bgeSmallEn;
        if (r == null) {
          logger.info("Creating tokenizer");
          Path path = Paths.get(BgeSmallEndpoint.MODEL_FOLDER);
          HuggingFaceTokenizer tokenizer =
              HuggingFaceTokenizer.builder()
                  .optTokenizerPath(path)
                  .optManager(NDManager.newBaseManager("PyTorch"))
                  .build();

          logger.info("Creating translator");
          MyTextEmbeddingTranslator translator =
              new MyTextEmbeddingTranslator(tokenizer, Batchifier.STACK, "cls", true, true);

          logger.info("Loading criteria");
          Criteria<String, float[]> criteria =
              Criteria.builder()
                  .setTypes(String.class, float[].class)
                  .optModelPath(path)
                  .optEngine("OnnxRuntime")
                  .optTranslator(translator)
                  .optProgress(new ProgressBar())
                  .build();
          try {
            r = criteria.loadModel();
            bgeSmallEn = r;
          } catch (IOException | ModelNotFoundException | MalformedModelException e) {
            logger.error("Failed to load model", e);
            throw new RuntimeException(e);
          }
        }
      }
    }
    return r;
  }

  // Custom TextEmbeddingTranslator for BGE-Small Onnx Model
  static final class MyTextEmbeddingTranslator implements Translator<String, float[]> {

    private static final int[] AXIS = {0};

    private HuggingFaceTokenizer tokenizer;
    private Batchifier batchifier;
    private boolean normalize;
    private String pooling;
    private boolean includeTokenTypes;

    MyTextEmbeddingTranslator(
        HuggingFaceTokenizer tokenizer,
        Batchifier batchifier,
        String pooling,
        boolean normalize,
        boolean includeTokenTypes) {
      this.tokenizer = tokenizer;
      this.batchifier = batchifier;
      this.pooling = pooling;
      this.normalize = normalize;
      this.includeTokenTypes = includeTokenTypes;
    }

    /** {@inheritDoc} */
    @Override
    public Batchifier getBatchifier() {
      return batchifier;
    }

    /** {@inheritDoc} */
    @Override
    public NDList processInput(TranslatorContext ctx, String input) {
      Encoding encoding = tokenizer.encode(input);
      ctx.setAttachment("encoding", encoding);
      return encoding.toNDList(ctx.getNDManager(), includeTokenTypes);
    }

    /** {@inheritDoc} */
    @Override
    public float[] processOutput(TranslatorContext ctx, NDList list) {
      Encoding encoding = (Encoding) ctx.getAttachment("encoding");
      NDManager manager = ctx.getNDManager();
      NDArray embeddings = processEmbedding(manager, list, encoding, pooling);
      if (normalize) {
        embeddings = embeddings.normalize(2, 0);
      }

      return embeddings.toFloatArray();
    }

    static NDArray processEmbedding(
        NDManager manager, NDList list, Encoding encoding, String pooling) {
      NDArray embedding = list.get("last_hidden_state");
      if (embedding == null) {
        // For Onnx model, NDArray name is not present
        embedding = list.head();
      }
      long[] attentionMask = encoding.getAttentionMask();
      try (NDManager ptManager = NDManager.newBaseManager("PyTorch");
          NDArray array = ptManager.create(attentionMask)) {
        NDArray inputAttentionMask = array.toType(DataType.FLOAT32, true);
        switch (pooling) {
          case "mean":
            return meanPool(embedding, inputAttentionMask, false);
          case "mean_sqrt_len":
            return meanPool(embedding, inputAttentionMask, true);
          case "max":
            return maxPool(embedding, inputAttentionMask);
          case "weightedmean":
            return weightedMeanPool(embedding, inputAttentionMask);
          case "cls":
            return embedding.get(0);
          default:
            throw new AssertionError("Unexpected pooling mode: " + pooling);
        }
      }
    }

    private static NDArray meanPool(NDArray embeddings, NDArray attentionMask, boolean sqrt) {
      long[] shape = embeddings.getShape().getShape();
      attentionMask = attentionMask.expandDims(-1).broadcast(shape);
      NDArray inputAttentionMaskSum = attentionMask.sum(AXIS);
      NDArray clamp = inputAttentionMaskSum.clip(1e-9, 1e12);
      NDArray prod = embeddings.mul(attentionMask);
      NDArray sum = prod.sum(AXIS);
      if (sqrt) {
        return sum.div(clamp.sqrt());
      }
      return sum.div(clamp);
    }

    private static NDArray maxPool(NDArray embeddings, NDArray inputAttentionMask) {
      long[] shape = embeddings.getShape().getShape();
      inputAttentionMask = inputAttentionMask.expandDims(-1).broadcast(shape);
      inputAttentionMask = inputAttentionMask.eq(0);
      embeddings = embeddings.duplicate();
      embeddings.set(inputAttentionMask, -1e9); // Set padding tokens to large negative value

      return embeddings.max(AXIS, true);
    }

    private static NDArray weightedMeanPool(NDArray embeddings, NDArray attentionMask) {
      long[] shape = embeddings.getShape().getShape();
      NDArray weight = embeddings.getManager().arange(1f, shape[0] + 1f);
      weight = weight.expandDims(-1).broadcast(shape);

      attentionMask = attentionMask.expandDims(-1).broadcast(shape).mul(weight);
      NDArray maskSum = attentionMask.sum(AXIS);
      NDArray embeddingSum = embeddings.mul(attentionMask).sum(AXIS);
      return embeddingSum.div(maskSum);
    }
  }
}
