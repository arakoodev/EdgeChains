package com.edgechain.lib.index.services.impl;

//public class RedisIndexChain extends IndexChainService {
//
//  private final Endpoint endpoint;
//  private final String namespace;
//
//  private static final String INDEX_NAME = "vector_index";
//
//  private final Logger logger = LoggerFactory.getLogger(this.getClass());
//
//  private final JedisPooled jedisPooled = ApplicationContextHolder.getContext().getBean(JedisPooled.class);
//
//  public RedisIndexChain(Endpoint endpoint, String namespace) {
//    this.endpoint = endpoint;
//    this.namespace = namespace;
//  }
//
//  public RedisIndexChain(Endpoint endpoint) {
//    this.endpoint = endpoint;
//    this.namespace = "knowledge";
//  }
//
//  @Override
//  public IndexChain upsert(WordEmbeddings words2Vec) {
//    return new IndexChain(
//        Observable.create(
//            emitter -> {
//              try {
//
//                this.createSearchIndex();
//
//                Map<byte[], byte[]> map = new HashMap<>();
//                map.put("id".getBytes(), words2Vec.getId().getBytes());
//                map.put(
//                    "values".getBytes(),
//                    FloatUtils.toByteArray(FloatUtils.toFloatArray(words2Vec.getValues())));
//                long v = jedisPooled.hset((namespace + ":" + words2Vec.getId()).getBytes(), map);
//
//                emitter.onNext(new StringResponse("Created ~ " + v));
//                emitter.onComplete();
//              } catch (final Exception e) {
//                emitter.onError(e);
//              }
//            }));
//  }
//
//  @Override
//  public EdgeChain<List<WordEmbeddings>> query(WordEmbeddings words2Vec, int topK, String namespace) {
//
//    return new EdgeChain<>(
//        Observable.create(
//            emitter -> {
//              try {
//                Query query =
//                    new Query("*=>[KNN $k @values $values]")
//                        .addParam(
//                            "values",
//                            FloatUtils.toByteArray(FloatUtils.toFloatArray(words2Vec.getValues())))
//                        .addParam("k", topK)
//                        .returnFields("id", "__values_score")
//                        .setSortBy("__values_score", false)
//                        .dialect(2);
//
//                SearchResult searchResult = jedisPooled.ftSearch(INDEX_NAME, query);
//
//                String body = JsonUtils.convertToString(searchResult);
//
//                RedisResponse redisResponse = JsonUtils.convertToObject(body, RedisResponse.class);
//
//                Iterator<RedisDocument> iterator = redisResponse.getDocuments().iterator();
//
//                List<WordEmbeddings> words2VecList = new ArrayList<>();
//
//                while (iterator.hasNext()) {
//                  ArrayList<RedisProperty> properties = iterator.next().getProperties();
//                  words2VecList.add(
//                      new WordEmbeddings(
//                          properties.get(1).getId(),
//                          String.valueOf(properties.get(0).get__values_score())));
//                }
//
//                emitter.onNext(words2VecList);
//                emitter.onComplete();
//
//              } catch (final Exception e) {
//                emitter.onError(e);
//              }
//            }));
//  }
//
//  @Override
//  public IndexChain deleteByIds(List<String> vectorIds, String namespace) {
//    return null;
//  }
//
//  @Override
//  public IndexChain deleteAll(String namespace) {
//    return null;
//  }
//
//  private void createSearchIndex() {
//    try {
//      Map<String, Object> map = jedisPooled.ftInfo(INDEX_NAME);
//      if (Objects.nonNull(map)) {
//        return;
//      }
//    } catch (Exception e) {
//      logger.info(e.getMessage());
//    }
//
//    Map<String, Object> attributes = new HashMap<>();
//    attributes.put("TYPE", "FLOAT32");
//    attributes.put("DIM", 1536);
//    attributes.put("DISTANCE_METRIC", "COSINE");
//    Schema schema =
//        new Schema()
//            .addTextField("id", 1)
//            .addVectorField("values", Schema.VectorField.VectorAlgo.HNSW, attributes);
//
//    IndexDefinition indexDefinition = new IndexDefinition().setPrefixes(namespace);
//
//    String ftCreate =
//        jedisPooled.ftCreate(
//            INDEX_NAME, IndexOptions.defaultOptions().setDefinition(indexDefinition), schema);
//
//    logger.info("Redis search vector_index created ~ " + ftCreate);
//  }
//}
