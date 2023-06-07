package com.edgechain.lib.configuration;

import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.repository.configuration.EnableRedisRepositories;


@Configuration
@ComponentScan(basePackages = {"com.edgechain.lib", "com.edgechain.lib.configuration"})
@EnableRedisRepositories(basePackages = {"com.edgechain.lib.context.repository"})
public class EdgeChainAutoConfiguration {



}
