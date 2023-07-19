package com.edgechain.lib.configuration;

import com.edgechain.lib.configuration.domain.SupabaseEnv;
import com.zaxxer.hikari.HikariDataSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.jdbc.DataSourceBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;

@Configuration
public class PostgreSQLConfiguration {

  @Autowired private SupabaseEnv supabaseEnv;

  @Bean
  public HikariDataSource dataSource() {

    HikariDataSource hikariDataSource =
        DataSourceBuilder.create()
            .type(HikariDataSource.class)
            .url(supabaseEnv.getDbHost())
            .driverClassName("org.postgresql.Driver")
            .username(supabaseEnv.getDbUsername())
            .password(supabaseEnv.getDbPassword())
            .build();

    return hikariDataSource;
  }

  @Bean
  public JdbcTemplate jdbcTemplate() {
    return new JdbcTemplate(dataSource());
  }
}
