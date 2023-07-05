package com.edgechain.lib.configuration;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Lazy;
import org.springframework.data.redis.connection.RedisPassword;
import org.springframework.data.redis.connection.RedisStandaloneConfiguration;
import org.springframework.data.redis.connection.jedis.JedisConnectionFactory;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.repository.configuration.EnableRedisRepositories;
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.StringRedisSerializer;
import redis.clients.jedis.JedisPooled;

@Configuration
@EnableRedisRepositories
public class RedisConfiguration {

  @Autowired @Lazy private RedisEnv redisEnv;

  @Bean
  public JedisPooled jedisPooled() {
    return new JedisPooled(
        redisEnv.getUrl(), redisEnv.getPort(), redisEnv.getUsername(), redisEnv.getPassword());
  }

  @Bean
  public JedisConnectionFactory jedisConnectionFactory() {
    RedisStandaloneConfiguration redisConfiguration = new RedisStandaloneConfiguration();
    redisConfiguration.setUsername(redisEnv.getUsername());
    redisConfiguration.setPassword(RedisPassword.of(redisEnv.getPassword()));
    redisConfiguration.setPort(redisEnv.getPort());
    redisConfiguration.setHostName(redisEnv.getUrl());
    return new JedisConnectionFactory(redisConfiguration);
  }

  @Bean
  public RedisTemplate<String, Object> redisTemplate() {
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
