package com.edgechain.lib.index.client.impl;

import com.edgechain.lib.configuration.context.ApplicationContextHolder;
import com.edgechain.lib.embeddings.WordEmbeddings;
import com.edgechain.lib.endpoint.impl.RedisEndpoint;
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

import redis.clients.jedis.JedisPooled;
import redis.clients.jedis.search.*;

import java.util.*;

public class RedisClient {

  private static final String REDIS_DELETE_SCRIPT_IN_LUA =
      "local keys = redis.call('keys', '%s')"
          + "  for i,k in ipairs(keys) do"
          + "    local res = redis.call('del', k)"
          + "  end";

  private RedisEndpoint endpoint;

  private String indexName;
  private String namespace;

  public RedisClient() {}

  public RedisClient(RedisEndpoint endpoint) {
    this.endpoint = endpoint;
  }

  public RedisClient(RedisEndpoint endpoint, String indexName, String namespace) {
    this.endpoint = endpoint;
    this.indexName = indexName;
    this.namespace = (Objects.isNull(namespace) || namespace.isEmpty()) ? "knowledge" : namespace;
  }

  private final Logger logger = LoggerFactory.getLogger(this.getClass());

  private final JedisPooled jedisPooled =
      ApplicationContextHolder.getContext().getBean(JedisPooled.class);

  public EdgeChain<StringResponse> upsert(
      WordEmbeddings words2Vec, int dimension, RedisDistanceMetric metric) {
    return new EdgeChain<>(
        Observable.create(
            emitter -> {
              try {

                this.createSearchIndex(dimension, RedisDistanceMetric.getDistanceMetric(metric));

                Map<byte[], byte[]> map = new HashMap<>();
                map.put("id".getBytes(), words2Vec.getId().getBytes());
                map.put(
                    "values".getBytes(),
                    FloatUtils.toByteArray(FloatUtils.toFloatArray(words2Vec.getValues())));

                long v =
                    jedisPooled.hset((this.namespace + ":" + words2Vec.getId()).getBytes(), map);

                jedisPooled.getPool().returnResource(jedisPooled.getPool().getResource());

                emitter.onNext(new StringResponse("Created ~ " + v));
                emitter.onComplete();
              } catch (Exception ex) {
                jedisPooled.getPool().returnBrokenResource(jedisPooled.getPool().getResource());
                emitter.onError(ex);
              }
            }),
        endpoint);
  }

  public EdgeChain<List<WordEmbeddings>> query(WordEmbeddings words2Vec, int topK) {

    return new EdgeChain<>(
        Observable.create(
            emitter -> {
              try {
                Query query =
                    new Query("*=>[KNN $k @values $values]")
                        .addParam(
                            "values",
                            FloatUtils.toByteArray(FloatUtils.toFloatArray(words2Vec.getValues())))
                        .addParam("k", topK)
                        .returnFields("id", "__values_score")
                        .setSortBy("__values_score", false)
                        .dialect(2);

                SearchResult searchResult = jedisPooled.ftSearch(this.indexName, query);

                String body = JsonUtils.convertToString(searchResult);

                RedisResponse redisResponse = JsonUtils.convertToObject(body, RedisResponse.class);

                Iterator<RedisDocument> iterator = redisResponse.getDocuments().iterator();

                List<WordEmbeddings> words2VecList = new ArrayList<>();

                while (iterator.hasNext()) {
                  ArrayList<RedisProperty> properties = iterator.next().getProperties();
                  words2VecList.add(
                      new WordEmbeddings(
                          properties.get(1).getId(),
                          String.valueOf(properties.get(0).get__values_score())));
                }

                emitter.onNext(words2VecList);
                emitter.onComplete();

              } catch (Exception ex) {
                emitter.onError(ex);
              }
            }),
        endpoint);
  }

  public EdgeChain<String> deleteByPattern(String pattern) {

    return new EdgeChain<>(
        Observable.create(
            emitter -> {
              try {
                jedisPooled.eval(String.format(REDIS_DELETE_SCRIPT_IN_LUA, pattern));

                jedisPooled.getPool().returnResource(jedisPooled.getPool().getResource());

                emitter.onNext("Redis deletion performed");
                emitter.onComplete();

              } catch (Exception ex) {
                jedisPooled.getPool().returnBrokenResource(jedisPooled.getPool().getResource());
                emitter.onError(ex);
              }
            }),
        endpoint);
  }

  private void createSearchIndex(int dimension, String metric) {
    try {
      Map<String, Object> map = jedisPooled.ftInfo(this.indexName);
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

    IndexDefinition indexDefinition = new IndexDefinition().setPrefixes(this.namespace);

    String ftCreate =
        jedisPooled.ftCreate(
            this.indexName, IndexOptions.defaultOptions().setDefinition(indexDefinition), schema);

    logger.info("Redis search vector_index created ~ " + ftCreate);
  }
}
