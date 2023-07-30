package com.edgechain.lib.configuration;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Lazy;
import org.springframework.core.env.Environment;
import org.springframework.data.redis.connection.RedisPassword;
import org.springframework.data.redis.connection.RedisStandaloneConfiguration;
import org.springframework.data.redis.connection.jedis.JedisConnectionFactory;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.repository.configuration.EnableRedisRepositories;
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.StringRedisSerializer;
import redis.clients.jedis.JedisPooled;

import java.util.Objects;

@Configuration
@EnableRedisRepositories
public class RedisConfiguration {

  @Autowired @Lazy private Environment env;

  @Bean
  @Lazy
  public JedisPooled jedisPooled() {
    return new JedisPooled(
        env.getProperty("redis.url"), Integer.parseInt(env.getProperty("redis.port")), env.getProperty("redis.username"), env.getProperty("redis.password"));
  }

  @Bean
  @Lazy
  public JedisConnectionFactory jedisConnectionFactory() {

    RedisStandaloneConfiguration redisConfiguration = new RedisStandaloneConfiguration();
    redisConfiguration.setUsername(env.getProperty("redis.username"));
    redisConfiguration.setPassword(RedisPassword.of(env.getProperty("redis.password")));
    if(Objects.isNull(env.getProperty("redis.port"))) {
      redisConfiguration.setPort(6379);
    }else{
      redisConfiguration.setPort(Integer.parseInt(env.getProperty("redis.port")));
    }
    redisConfiguration.setHostName(env.getProperty("redis.url"));
    return new JedisConnectionFactory(redisConfiguration);
  }

  @Bean
  @ConditionalOnBean(name = "redisEnv")
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
