package com.edgechain.lib.configuration;

import java.util.Objects;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Lazy;
import org.springframework.core.env.Environment;
import org.springframework.data.redis.connection.RedisPassword;
import org.springframework.data.redis.connection.RedisStandaloneConfiguration;
import org.springframework.data.redis.connection.jedis.JedisConnectionFactory;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.StringRedisSerializer;
import redis.clients.jedis.JedisPooled;

@Configuration
public class RedisConfiguration {

  @Autowired @Lazy private Environment env;

  @Bean
  @Lazy
  JedisPooled jedisPooled() {

    int port = 6379;
    String host = "127.0.0.1";

    if (Objects.nonNull(env.getProperty("redis.port"))) {
      port = Integer.parseInt(env.getProperty("redis.port"));
    }

    if (Objects.nonNull(env.getProperty("redis.url"))) {
      host = env.getProperty("redis.url");
    }

    return new JedisPooled(
        host, port, env.getProperty("redis.username"), env.getProperty("redis.password"));
  }

  @Bean
  @Lazy
  JedisConnectionFactory jedisConnectionFactory() {

    int port = 6379;
    String host = "127.0.0.1";

    if (Objects.nonNull(env.getProperty("redis.port"))) {
      port = Integer.parseInt(env.getProperty("redis.port"));
    }

    if (Objects.nonNull(env.getProperty("redis.url"))) {
      host = env.getProperty("redis.url");
    }

    RedisStandaloneConfiguration redisConfiguration = new RedisStandaloneConfiguration();
    redisConfiguration.setUsername(env.getProperty("redis.username"));
    redisConfiguration.setPassword(RedisPassword.of(env.getProperty("redis.password")));
    redisConfiguration.setPort(port);
    redisConfiguration.setHostName(host);

    return new JedisConnectionFactory(redisConfiguration);
  }

  @Bean
  RedisTemplate<String, Object> redisTemplate() {
    RedisTemplate<String, Object> redisTemplate = new RedisTemplate<>();
    redisTemplate.setConnectionFactory(jedisConnectionFactory());
    redisTemplate.setKeySerializer(new StringRedisSerializer());
    redisTemplate.setHashKeySerializer(new GenericJackson2JsonRedisSerializer());
    redisTemplate.setHashKeySerializer(new GenericJackson2JsonRedisSerializer());
    redisTemplate.setValueSerializer(new GenericJackson2JsonRedisSerializer());
    redisTemplate.setEnableTransactionSupport(true);
    redisTemplate.afterPropertiesSet();
    return redisTemplate;
  }
}
