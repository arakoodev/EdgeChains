package com.edgechain.lib.configuration;

import com.zaxxer.hikari.HikariDataSource;
import org.springframework.boot.jdbc.DataSourceBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;

@Configuration
public class PostgreSQLConfiguration {

  @Bean
  public HikariDataSource dataSource() {

    HikariDataSource hikariDataSource =
        DataSourceBuilder.create()
            .type(HikariDataSource.class)
            .url(System.getProperty("postgres.jdbc.url"))
            .driverClassName("org.postgresql.Driver")
            .username(System.getProperty("postgres.jdbc.username"))
            .password(System.getProperty("postgres.jdbc.password"))
            .build();

    hikariDataSource.setMaxLifetime(0);

    return hikariDataSource;
  }

  @Bean
  public JdbcTemplate jdbcTemplate() {
    return new JdbcTemplate(dataSource());
  }
}
