package com.edgechain.app.configuration;

import org.springframework.cloud.openfeign.EnableFeignClients;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;

@Order(Ordered.HIGHEST_PRECEDENCE)
@Configuration
@EnableFeignClients(basePackages = {"com.edgechain.app"})
public class WebConfiguration {
}
