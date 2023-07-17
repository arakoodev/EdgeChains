package com.edgechain.lib.configuration;

import org.springframework.boot.jdbc.DataSourceBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;

import javax.sql.DataSource;
import java.util.Objects;

@Order(Ordered.HIGHEST_PRECEDENCE)
@Configuration("WebConfiguration")
@Import(EdgeChainAutoConfiguration.class)
public class WebConfiguration {}
