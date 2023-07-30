package com.edgechain.lib.configuration;

import com.zaxxer.hikari.HikariDataSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.jdbc.DataSourceBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Lazy;
import org.springframework.core.env.Environment;
import org.springframework.jdbc.core.JdbcTemplate;

import javax.sql.DataSource;
import java.util.Objects;
import java.util.Properties;

@Configuration
public class PostgreSQLConfiguration {

  @Autowired
  private Environment env;

  @Bean
  public DataSource dataSource() {

    String dbHost = env.getProperty("postgres.db.host");
    String dbUsername = env.getProperty("postgres.db.username");
    String dbPassword =env.getProperty("postgres.db.password");

    return DataSourceBuilder.create()
            .url(dbHost)
            .driverClassName("org.postgresql.Driver")
            .username(dbUsername)
            .password(dbPassword)
            .build();



//    return DataSourceBuilder.create()
//              .type(HikariDataSource.class)
//              .url(dbHost)
//              .driverClassName("org.postgresql.Driver")
//              .username(dbUsername)
//              .password(dbPassword)
//              .build();
  }

  @Bean
  public JdbcTemplate jdbcTemplate() {
    return new JdbcTemplate(dataSource());
  }

  private boolean nonNullAndNotEmpty(String val) {
      return Objects.nonNull(val) && val.trim().isEmpty();
  }
}
