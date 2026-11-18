package com.edgechain.lib.supabase.security;

import java.security.Principal;

import com.edgechain.lib.supabase.entities.User;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.convert.converter.Converter;
import org.springframework.format.FormatterRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

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
