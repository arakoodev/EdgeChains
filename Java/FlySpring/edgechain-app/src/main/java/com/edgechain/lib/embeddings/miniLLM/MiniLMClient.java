package com.edgechain.lib.embeddings.miniLLM;

import ai.djl.MalformedModelException;
import ai.djl.huggingface.translator.TextEmbeddingTranslatorFactory;
import ai.djl.inference.Predictor;
import ai.djl.repository.zoo.Criteria;
import ai.djl.repository.zoo.ModelNotFoundException;
import ai.djl.repository.zoo.ZooModel;
import ai.djl.training.util.ProgressBar;
import com.edgechain.lib.embeddings.miniLLM.enums.MiniLMModel;
import com.edgechain.lib.embeddings.miniLLM.response.MiniLMResponse;
import com.edgechain.lib.endpoint.impl.embeddings.MiniLMEndpoint;
import com.edgechain.lib.rxjava.transformer.observable.EdgeChain;
import io.reactivex.rxjava3.core.Observable;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.util.LinkedList;
import java.util.List;

@Service
public class MiniLMClient {

  private static volatile ZooModel<String, float[]> allMiniL6V2;
  private static volatile ZooModel<String, float[]> allMiniL12V2;

  private static volatile ZooModel<String, float[]> paraphraseMiniLML3v2;

  private static volatile ZooModel<String, float[]> multiQAMiniLML6CosV1;

  public EdgeChain<MiniLMResponse> createEmbeddings(String input, MiniLMEndpoint endpoint) {

    return new EdgeChain<>(
        Observable.create(
            emitter -> {
              try {

                if (endpoint.getMiniLMModel().equals(MiniLMModel.ALL_MINILM_L6_V2)) {

                  Predictor<String, float[]> predictor =
                      loadAllMiniL6V2(endpoint.getMiniLMModel()).newPredictor();

                  float[] predict = predictor.predict(input);

                  List<Float> floatList = new LinkedList<>();
                  for (float v : predict) {
                    floatList.add(v);
                  }

                  emitter.onNext(new MiniLMResponse(floatList));
                  emitter.onComplete();
                } else if (endpoint.getMiniLMModel().equals(MiniLMModel.ALL_MINILM_L12_V2)) {

                  Predictor<String, float[]> predictor =
                      loadAllMiniL12V2(endpoint.getMiniLMModel()).newPredictor();

                  float[] predict = predictor.predict(input);

                  List<Float> floatList = new LinkedList<>();
                  for (float v : predict) {
                    floatList.add(v);
                  }

                  emitter.onNext(new MiniLMResponse(floatList));
                  emitter.onComplete();
                } else if (endpoint.getMiniLMModel().equals(MiniLMModel.PARAPHRASE_MINILM_L3_V2)) {
                  Predictor<String, float[]> predictor =
                      loadParaphraseMiniLML3v2(endpoint.getMiniLMModel()).newPredictor();

                  float[] predict = predictor.predict(input);

                  List<Float> floatList = new LinkedList<>();
                  for (float v : predict) {
                    floatList.add(v);
                  }

                  emitter.onNext(new MiniLMResponse(floatList));
                  emitter.onComplete();
                } else {

                  System.out.println("d");
                  ZooModel<String, float[]> zooModel =
                      loadMultiQAMiniLML6CosV1(endpoint.getMiniLMModel());

                  Predictor<String, float[]> predictor = zooModel.newPredictor();

                  float[] predict = predictor.predict(input);

                  List<Float> floatList = new LinkedList<>();
                  for (float v : predict) {
                    floatList.add(v);
                  }

                  emitter.onNext(new MiniLMResponse(floatList));
                  emitter.onComplete();
                }

              } catch (final Exception e) {
                emitter.onError(e);
              }
            }),
        endpoint);
  }

  private ZooModel<String, float[]> loadAllMiniL6V2(MiniLMModel miniLMModel) {

    ZooModel<String, float[]> r = allMiniL6V2;

    if (r == null) {
      synchronized (this) {
        r = allMiniL6V2;
        if (r == null) {

          Criteria<String, float[]> criteria =
              Criteria.builder()
                  .setTypes(String.class, float[].class)
                  .optModelUrls(MiniLMModel.getURL(miniLMModel))
                  .optEngine("PyTorch")
                  .optTranslatorFactory(new TextEmbeddingTranslatorFactory())
                  .optProgress(new ProgressBar())
                  .build();

          try {
            r = criteria.loadModel();
            allMiniL6V2 = r;
          } catch (IOException | ModelNotFoundException | MalformedModelException e) {
            throw new RuntimeException(e);
          }
        }
      }
    }
    return r;
  }

  private ZooModel<String, float[]> loadAllMiniL12V2(MiniLMModel miniLMModel) {

    ZooModel<String, float[]> r = allMiniL12V2;

    if (r == null) {
      synchronized (this) {
        r = allMiniL12V2;
        if (r == null) {

          Criteria<String, float[]> criteria =
              Criteria.builder()
                  .setTypes(String.class, float[].class)
                  .optModelUrls(MiniLMModel.getURL(miniLMModel))
                  .optEngine("PyTorch")
                  .optTranslatorFactory(new TextEmbeddingTranslatorFactory())
                  .optProgress(new ProgressBar())
                  .build();

          try {
            r = criteria.loadModel();
            allMiniL12V2 = r;
          } catch (IOException | ModelNotFoundException | MalformedModelException e) {
            throw new RuntimeException(e);
          }
        }
      }
    }

    return r;
  }

  private ZooModel<String, float[]> loadParaphraseMiniLML3v2(MiniLMModel miniLMModel) {

    ZooModel<String, float[]> r = paraphraseMiniLML3v2;

    if (r == null) {
      synchronized (this) {
        r = paraphraseMiniLML3v2;
        if (r == null) {

          Criteria<String, float[]> criteria =
              Criteria.builder()
                  .setTypes(String.class, float[].class)
                  .optModelUrls(MiniLMModel.getURL(miniLMModel))
                  .optEngine("PyTorch")
                  .optTranslatorFactory(new TextEmbeddingTranslatorFactory())
                  .optProgress(new ProgressBar())
                  .build();

          try {
            r = criteria.loadModel();
            paraphraseMiniLML3v2 = r;
          } catch (IOException | ModelNotFoundException | MalformedModelException e) {
            throw new RuntimeException(e);
          }
        }
      }
    }
    return r;
  }

  private ZooModel<String, float[]> loadMultiQAMiniLML6CosV1(MiniLMModel miniLMModel) {

    ZooModel<String, float[]> r = multiQAMiniLML6CosV1;

    if (r == null) {
      synchronized (this) {
        r = multiQAMiniLML6CosV1;
        if (r == null) {
          Criteria<String, float[]> criteria =
              Criteria.builder()
                  .setTypes(String.class, float[].class)
                  .optModelUrls(MiniLMModel.getURL(miniLMModel))
                  .optEngine("PyTorch")
                  .optTranslatorFactory(new TextEmbeddingTranslatorFactory())
                  .optProgress(new ProgressBar())
                  .build();

          try {
            r = criteria.loadModel();
            multiQAMiniLML6CosV1 = r;
          } catch (IOException | ModelNotFoundException | MalformedModelException e) {
            throw new RuntimeException(e);
          }
        }
      }
    }

    return r;
  }
}
