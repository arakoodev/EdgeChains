package com.edgechain.lib.configuration;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import redis.clients.jedis.JedisPooled;

@Configuration
public class RedisConfiguration {


    @Value("${spring.data.redis.host}")
    private String url;

    @Value("${spring.data.redis.port}")
    private int port;

    @Value("${spring.data.redis.username}")
    private String username;

    @Value("${spring.data.redis.password}")
    private String password;


    @Bean
    public JedisPooled jedisPooled() {
        return new JedisPooled(url, port,username,password);
    }


}
