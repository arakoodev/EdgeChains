package com.edgechain.lib.supabase.security;

import com.auth0.jwt.JWT;
import com.auth0.jwt.algorithms.Algorithm;
import com.edgechain.lib.configuration.WebConfiguration;
import com.edgechain.lib.configuration.domain.SecurityUUID;
import java.util.Date;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.SpringBootTest.WebEnvironment;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(webEnvironment = WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
class WebSecurityContextPathTest {

  private static final String FULL_CONTEXT_PATH = WebConfiguration.CONTEXT_PATH + "/";

  @Autowired
  private MockMvc mvc;

  @Autowired
  private SecurityUUID securityUUID;
  
  // ====== TEST CONTEXT-BASED SECURITY (uuid must be in header) ======

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
