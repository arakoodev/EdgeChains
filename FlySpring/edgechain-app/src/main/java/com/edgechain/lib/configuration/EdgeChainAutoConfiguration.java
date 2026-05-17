package com.edgechain.lib.configuration;

import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.Configuration;

@Configuration
@ComponentScan(basePackages = {"com.edgechain.lib", "com.edgechain.lib.configuration"})
public class EdgeChainAutoConfiguration {}
