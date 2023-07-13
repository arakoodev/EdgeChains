package com.app.supabase.security;

import com.app.supabase.entities.User;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.convert.converter.Converter;
import org.springframework.format.FormatterRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.security.Principal;

@Configuration
public class PrincipalConverter implements WebMvcConfigurer {
  @Override
  public void addFormatters(FormatterRegistry registry) {
    registry.addConverter(new PSC());
  }

  public class PSC implements Converter<Principal, User> {
    @Override
    public User convert(Principal from) {
      return (User) from;
    }
  }
}
