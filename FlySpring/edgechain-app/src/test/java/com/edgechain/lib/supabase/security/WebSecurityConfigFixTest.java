package com.edgechain.lib.supabase.security;

import com.edgechain.lib.configuration.WebConfiguration;
import com.edgechain.lib.configuration.domain.AuthFilter;
import com.edgechain.lib.configuration.domain.MethodAuthentication;
import com.edgechain.lib.configuration.domain.SecurityUUID;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.test.context.SpringBootTest.WebEnvironment;
import org.springframework.context.annotation.Bean;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.web.servlet.MockMvc;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(webEnvironment = WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@ContextConfiguration(name = "contextWithBadPattersAuthFilter")
class WebSecurityConfigFixTest {

  // ====== TEST CONTEXT-BASED SECURITY (uuid must be in header) ======
  
  private static final String FULL_CONTEXT_PATH = WebConfiguration.CONTEXT_PATH + "/";

  @TestConfiguration
  public static class AuthFilterTestConfig {
    @Bean
    AuthFilter authFilter() {
      AuthFilter auth = new AuthFilter();
      auth.setRequestGet(new MethodAuthentication(List.of(""), "ROLE_ADMIN1", "ROLE_AI1"));
      auth.setRequestDelete(new MethodAuthentication(List.of(""), "ROLE_ADMIN2", "ROLE_AI2"));
      auth.setRequestPatch(new MethodAuthentication(List.of(""), "ROLE_ADMIN3", "ROLE_AI3"));
      auth.setRequestPost(new MethodAuthentication(List.of(""), "ROLE_ADMIN4", "ROLE_AI4"));
      auth.setRequestPut(new MethodAuthentication(List.of(""), "ROLE_ADMIN5", "ROLE_AI5"));
      return auth;
    }
  }
  
  @Autowired
  private MockMvc mvc;

  @Autowired
  private SecurityUUID securityUUID;

  @Test
  void getContextEndpoint() throws Exception {
    mvc.perform(
        get(FULL_CONTEXT_PATH)
            .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
            .header("Authorization", securityUUID.getAuthKey()))
        .andExpect(status().isNotFound());
  }

  @Test
  void postContextEndpoint() throws Exception {
    mvc.perform(
        post(FULL_CONTEXT_PATH)
            .content("{}")
            .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
            .header("Authorization", securityUUID.getAuthKey()))
        .andExpect(status().isNotFound());
  }

  @Test
  void deleteContextEndpoint() throws Exception {
    mvc.perform(
        delete(FULL_CONTEXT_PATH)
            .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
            .header("Authorization", securityUUID.getAuthKey()))
        .andExpect(status().isNotFound());
  }

  @Test
  void patchContextEndpoint() throws Exception {
    mvc.perform(
        patch(FULL_CONTEXT_PATH)
            .content("{}")
            .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
            .header("Authorization", securityUUID.getAuthKey()))
        .andExpect(status().isNotFound());
  }

  @Test
  void putContextEndpoint() throws Exception {
    mvc.perform(
        put(FULL_CONTEXT_PATH)
            .content("{}")
            .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
            .header("Authorization", securityUUID.getAuthKey()))
        .andExpect(status().isNotFound());
  }

}
