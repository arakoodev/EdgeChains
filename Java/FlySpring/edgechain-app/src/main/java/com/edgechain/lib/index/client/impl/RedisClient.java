package com.edgechain.lib.index.client.impl;

import com.edgechain.lib.embeddings.WordEmbeddings;
import com.edgechain.lib.endpoint.impl.index.RedisEndpoint;
import com.edgechain.lib.index.enums.RedisDistanceMetric;
import com.edgechain.lib.index.responses.RedisDocument;
import com.edgechain.lib.index.responses.RedisProperty;
import com.edgechain.lib.index.responses.RedisResponse;
import com.edgechain.lib.response.StringResponse;
import com.edgechain.lib.rxjava.transformer.observable.EdgeChain;
import com.edgechain.lib.utils.FloatUtils;
import com.edgechain.lib.utils.JsonUtils;
import io.reactivex.rxjava3.core.Observable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import redis.clients.jedis.*;
import redis.clients.jedis.search.*;

import java.util.*;

@Service
public class RedisClient {

  private static final String REDIS_DELETE_SCRIPT_IN_LUA =
      "local keys = redis.call('keys', '%s')"
          + "  for i,k in ipairs(keys) do"
          + "    local res = redis.call('del', k)"
          + "  end";

  private final Logger logger = LoggerFactory.getLogger(this.getClass());

  @Autowired private JedisPooled jedisPooled;

  public EdgeChain<StringResponse> createIndex(RedisEndpoint endpoint) {
    return new EdgeChain<>(
        Observable.create(
            emitter -> {
              try {
                this.createSearchIndex(
                    getNamespace(endpoint),
                    endpoint.getIndexName(),
                    endpoint.getDimensions(),
                    endpoint.getMetric());
                emitter.onNext(new StringResponse("Created Index ~ "));
                emitter.onComplete();
              } catch (final Exception e) {
                emitter.onError(e);
              }
            }));
  }

  public EdgeChain<StringResponse> upsert(RedisEndpoint endpoint) {

    return new EdgeChain<>(
        Observable.create(
            emitter -> {
              try (Jedis jedis = new Jedis(jedisPooled.getPool().getResource())) {

                Map<byte[], byte[]> map = new HashMap<>();
                map.put("id".getBytes(), endpoint.getWordEmbedding().getId().getBytes());
                map.put(
                    "values".getBytes(),
                    FloatUtils.toByteArray(
                        FloatUtils.toFloatArray(endpoint.getWordEmbedding().getValues())));

                long v =
                    jedis.hset(
                        (getNamespace(endpoint) + ":" + endpoint.getWordEmbedding().getId())
                            .getBytes(),
                        map);

                emitter.onNext(new StringResponse("Created ~ " + v));
                emitter.onComplete();
              } catch (Exception ex) {
                emitter.onError(ex);
              }
            }),
        endpoint);
  }

  public EdgeChain<StringResponse> batchUpsert(RedisEndpoint endpoint) {
    return new EdgeChain<>(
        Observable.create(
            emitter -> {
              try (Jedis jedis = new Jedis(jedisPooled.getPool().getResource())) {

                Pipeline pipeline = jedis.pipelined();

                for (WordEmbeddings w : endpoint.getWordEmbeddingsList()) {
                  Map<byte[], byte[]> map = new HashMap<>();
                  map.put("id".getBytes(), w.getId().getBytes());
                  map.put(
                      "values".getBytes(),
                      FloatUtils.toByteArray(FloatUtils.toFloatArray(w.getValues())));

                  pipeline.hmset((getNamespace(endpoint) + ":" + w.getId()).getBytes(), map);
                }

                pipeline.sync();

                emitter.onNext(new StringResponse("Batch Processing Completed"));
                emitter.onComplete();
              } catch (Exception ex) {

                emitter.onError(ex);
              }
            }),
        endpoint);
  }

  public EdgeChain<List<WordEmbeddings>> query(RedisEndpoint endpoint) {

    return new EdgeChain<>(
        Observable.create(
            emitter -> {
              try {
                Query query =
                    new Query("*=>[KNN $k @values $values]")
                        .addParam(
                            "values",
                            FloatUtils.toByteArray(
                                FloatUtils.toFloatArray(endpoint.getWordEmbedding().getValues())))
                        .addParam("k", endpoint.getTopK())
                        .returnFields("id", "__values_score")
                        .setSortBy("__values_score", false)
                        .dialect(2);

                SearchResult searchResult = jedisPooled.ftSearch(endpoint.getIndexName(), query);

                String body = JsonUtils.convertToString(searchResult);

                RedisResponse redisResponse = JsonUtils.convertToObject(body, RedisResponse.class);

                Iterator<RedisDocument> iterator = redisResponse.getDocuments().iterator();

                List<WordEmbeddings> words2VecList = new ArrayList<>();

                while (iterator.hasNext()) {
                  ArrayList<RedisProperty> properties = iterator.next().getProperties();
                  words2VecList.add(
                      new WordEmbeddings(
                          properties.get(1).getId(), properties.get(0).get__values_score()));
                }

                emitter.onNext(words2VecList);
                emitter.onComplete();

              } catch (Exception ex) {
                jedisPooled.getPool().returnBrokenResource(jedisPooled.getPool().getResource());
                emitter.onError(ex);
              }
            }),
        endpoint);
  }

  public EdgeChain<StringResponse> deleteByPattern(RedisEndpoint endpoint) {

    return new EdgeChain<>(
        Observable.create(
            emitter -> {
              try (Jedis jedis = new Jedis(jedisPooled.getPool().getResource())) {

                jedis.eval(String.format(REDIS_DELETE_SCRIPT_IN_LUA, endpoint.getPattern()));

                emitter.onNext(
                    new StringResponse(
                        "Word embeddings are successfully deleted for pattern:"
                            + endpoint.getPattern()));
                emitter.onComplete();

              } catch (Exception ex) {
                emitter.onError(ex);
              }
            }),
        endpoint);
  }

  private void createSearchIndex(
      String namespace, String indexName, int dimension, RedisDistanceMetric metric) {
    try {
      Map<String, Object> map = jedisPooled.ftInfo(indexName);
      if (Objects.nonNull(map)) {
        return;
      }
    } catch (Exception e) {
      logger.info(e.getMessage());
    }

    Map<String, Object> attributes = new HashMap<>();
    attributes.put("TYPE", "FLOAT32");
    attributes.put("DIM", dimension);
    attributes.put("DISTANCE_METRIC", metric);
    Schema schema =
        new Schema()
            .addTextField("id", 1)
            .addVectorField("values", Schema.VectorField.VectorAlgo.HNSW, attributes);

    IndexDefinition indexDefinition = new IndexDefinition().setPrefixes(namespace);

    String ftCreate =
        jedisPooled.ftCreate(
            indexName, IndexOptions.defaultOptions().setDefinition(indexDefinition), schema);

    logger.info("Redis search vector_index created ~ " + ftCreate);
  }

  private String getNamespace(RedisEndpoint endpoint) {
    return (Objects.isNull(endpoint.getNamespace()) || endpoint.getNamespace().isEmpty())
        ? "knowledge"
        : endpoint.getNamespace();
  }
}
