package com.edgechain.lib.configuration;

import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;

@Order(Ordered.HIGHEST_PRECEDENCE)
@Configuration("WebConfiguration")
@Import(EdgeChainAutoConfiguration.class)
public class WebConfiguration {}
