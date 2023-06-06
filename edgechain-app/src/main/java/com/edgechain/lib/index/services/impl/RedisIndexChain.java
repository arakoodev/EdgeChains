package com.edgechain.lib.index.services.impl;

import com.edgechain.lib.embeddings.domain.WordVec;
import com.edgechain.lib.index.services.IndexChainService;
import com.edgechain.lib.openai.chains.IndexChain;
import com.edgechain.lib.openai.endpoint.Endpoint;
import com.edgechain.lib.rxjava.response.ChainResponse;
import com.edgechain.lib.utils.FloatUtils;
import com.edgechain.lib.utils.JsonUtils;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.reactivex.rxjava3.core.Observable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import redis.clients.jedis.JedisPooled;
import redis.clients.jedis.search.*;

import java.util.*;

@Service
public class RedisIndexChain extends IndexChainService {

    private static final String INDEX_NAME = "vector_index";
    private static final String PREFIXES = "knowledge:";

    private final Logger logger = LoggerFactory.getLogger(this.getClass());

    @Autowired
    private JedisPooled jedisPooled;


    @Override
    public IndexChain upsert(WordVec wordVec) {
        return new IndexChain(
                Observable.create(emitter -> {
                   try {

                       this.createSearchIndex();

                       Map<byte[], byte[]> map = new HashMap<>();
                       map.put("id".getBytes(), wordVec.getId().getBytes());
                       map.put("values".getBytes(), FloatUtils.toByteArray(FloatUtils.toFloatArray(wordVec.getValues())));
                       long v = jedisPooled.hset((PREFIXES + UUID.randomUUID()).getBytes(), map);

                       emitter.onNext(new ChainResponse("Created ~ "+v));
                        emitter.onComplete();
                   }catch (final Exception e){
                       emitter.onError(e);
                   }
                })
        );
    }

    @Override
    public IndexChain query(WordVec wordVec, int topK) {

        return new IndexChain(Observable.create(emitter -> {
            try {
                Query query = new Query("*=>[KNN $k @values $values]")
                        .addParam("values", FloatUtils.toByteArray(FloatUtils.toFloatArray(wordVec.getValues())))
                        .addParam("k", topK)
//                        .returnFields("id", "__values_score")
                        .returnFields("id")
                        .setSortBy("__values_score", false)
                        .dialect(2);
                SearchResult searchResult = jedisPooled.ftSearch(INDEX_NAME, query);

                String body = JsonUtils.convertToString(searchResult);
                System.out.println(body);

                StringBuilder stringBuilder = new StringBuilder();

                List<Document> documents = searchResult.getDocuments();
                for(Document d: documents){

                    Iterator<Map.Entry<String, Object>> iterator = d.getProperties().iterator();

                    while (iterator.hasNext()) {
                        Map.Entry<String, Object> entry = iterator.next();
                        stringBuilder.append(entry.getValue()).append("\n");
                    }

                }
                stringBuilder.deleteCharAt(stringBuilder.length() - 1);

                emitter.onNext(new ChainResponse(stringBuilder.toString()));
                emitter.onComplete();

            }catch (final Exception e){
                emitter.onError(e);
            }
        }));

    }

    @Override
    public IndexChain deleteByIds(List<String> vectorIds) {
        return null;
    }

    @Override
    public IndexChain deleteAll() {
        return null;
    }


    private void createSearchIndex() {

        try {
            Map<String, Object> map = jedisPooled.ftInfo(INDEX_NAME);
            if (Objects.nonNull(map)) {
                return;
            }
        } catch (Exception e) {
            logger.info(e.getMessage());
        }

        Map<String, Object> attributes = new HashMap<>();
        attributes.put("TYPE", "FLOAT32");
        attributes.put("DIM", 1536);
        attributes.put("DISTANCE_METRIC", "COSINE");
        Schema schema = new Schema()
                .addTextField("id", 1)
                .addVectorField("values", Schema.VectorField.VectorAlgo.HNSW, attributes);

        IndexDefinition indexDefinition = new IndexDefinition().setPrefixes(PREFIXES);

        String ftCreate = jedisPooled.ftCreate(INDEX_NAME, IndexOptions.defaultOptions().setDefinition(indexDefinition), schema);

        logger.info("Redis search vector_index created ~ " + ftCreate);

    }
}
