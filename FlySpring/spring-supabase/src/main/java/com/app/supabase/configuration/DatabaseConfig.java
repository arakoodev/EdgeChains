package com.app.supabase.configuration;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.jdbc.DataSourceBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import javax.sql.DataSource;

@Configuration
public class DatabaseConfig {

  @Autowired private SupabaseEnv supabaseEnv;

  @Bean
  public DataSource getDataSource() {

    DataSourceBuilder<?> dataSourceBuilder = DataSourceBuilder.create();
    dataSourceBuilder.url(this.supabaseEnv.getDbHost());
    dataSourceBuilder.username(this.supabaseEnv.getDbUsername());
    dataSourceBuilder.password(this.supabaseEnv.getDbPassword());
    return dataSourceBuilder.build();
  }
}
