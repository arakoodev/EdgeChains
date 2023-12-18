package com.edgechain.lib.supabase.security;

import com.edgechain.lib.configuration.domain.AuthFilter;
import com.edgechain.lib.configuration.domain.MethodAuthentication;
import com.edgechain.testutil.TestJwtCreator;
import java.util.List;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.SpringBootTest.WebEnvironment;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.web.servlet.MockMvc;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ActiveProfiles("test")
@SpringBootTest(webEnvironment = WebEnvironment.RANDOM_PORT)
@AutoConfigureMockMvc
@ContextConfiguration(name = "contextWithTestRolesAuthFilter")
class WebSecurityJwtWithRoleTest {

  // ====== TEST JWT-BASED SECURITY WITH ROLES (bearer token must be in header) ======

  private static final String FULL_NONCONTEXT_PATH = "/v0/endpoint/";

  @TestConfiguration
  public static class AuthFilterTestConfig {
    @Bean
    AuthFilter authFilter() {
      // provide an AuthFilter with roles to check we test the correct role for each method
      AuthFilter auth = new AuthFilter();
      auth.setRequestGet(new MethodAuthentication(List.of("**"), "ROLE_ADMIN1", "ROLE_AI1"));
      auth.setRequestDelete(new MethodAuthentication(List.of("**"), "ROLE_ADMIN2", "ROLE_AI2"));
      auth.setRequestPatch(new MethodAuthentication(List.of("**"), "ROLE_ADMIN3", "ROLE_AI3"));
      auth.setRequestPost(new MethodAuthentication(List.of("**"), "ROLE_ADMIN4", "ROLE_AI4"));
      auth.setRequestPut(new MethodAuthentication(List.of("**"), "ROLE_ADMIN5", "ROLE_AI5"));
      return auth;
    }
  }

  @BeforeAll
  static void setupAll() {
    System.setProperty("jwt.secret", "edge-chain-unit-test-jwt-secret");
  }

  @Autowired private MockMvc mvc;

  @Autowired private JwtHelper jwtHelper;

  @Test
  void validateJwt() {
    String jwt = TestJwtCreator.generate("ROLE_TEST");
    assertTrue(jwtHelper.validate(jwt));
  }

  @Test
  void getEndpoint() throws Exception {
    String jwt = TestJwtCreator.generate("ROLE_ADMIN1");
    mvc.perform(
            get(FULL_NONCONTEXT_PATH)
                .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .header("Authorization", "Bearer " + jwt))
        .andExpect(status().isNotFound());
  }

  @Test
  void getEndpoint_notAuth() throws Exception {
    String jwt = TestJwtCreator.generate("ROLE_NO_ACCESS");
    mvc.perform(
            get(FULL_NONCONTEXT_PATH)
                .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .header("Authorization", "Bearer " + jwt))
        .andExpect(status().isForbidden());
  }

  @Test
  void postEndpoint() throws Exception {
    String jwt = TestJwtCreator.generate("ROLE_ADMIN4");
    mvc.perform(
            post(FULL_NONCONTEXT_PATH)
                .content("{}")
                .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .header("Authorization", "Bearer " + jwt))
        .andExpect(status().isNotFound());
  }

  @Test
  void postEndpoint_notAuth() throws Exception {
    String jwt = TestJwtCreator.generate("ROLE_NO_ACCESS");
    mvc.perform(
            post(FULL_NONCONTEXT_PATH)
                .content("{}")
                .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .header("Authorization", "Bearer " + jwt))
        .andExpect(status().isForbidden());
  }

  @Test
  void deleteEndpoint() throws Exception {
    String jwt = TestJwtCreator.generate("ROLE_ADMIN2");
    mvc.perform(
            delete(FULL_NONCONTEXT_PATH)
                .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .header("Authorization", "Bearer " + jwt))
        .andExpect(status().isNotFound());
  }

  @Test
  void deleteEndpoint_notAuth() throws Exception {
    String jwt = TestJwtCreator.generate("ROLE_NO_ACCESS");
    mvc.perform(
            delete(FULL_NONCONTEXT_PATH)
                .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .header("Authorization", "Bearer " + jwt))
        .andExpect(status().isForbidden());
  }

  @Test
  void patchEndpoint() throws Exception {
    String jwt = TestJwtCreator.generate("ROLE_ADMIN3");
    mvc.perform(
            patch(FULL_NONCONTEXT_PATH)
                .content("{}")
                .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .header("Authorization", "Bearer " + jwt))
        .andExpect(status().isNotFound());
  }

  @Test
  void patchEndpoint_notAuth() throws Exception {
    String jwt = TestJwtCreator.generate("ROLE_NO_ACCESS");
    mvc.perform(
            patch(FULL_NONCONTEXT_PATH)
                .content("{}")
                .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .header("Authorization", "Bearer " + jwt))
        .andExpect(status().isForbidden());
  }

  @Test
  void putEndpoint() throws Exception {
    String jwt = TestJwtCreator.generate("ROLE_ADMIN5");
    mvc.perform(
            put(FULL_NONCONTEXT_PATH)
                .content("{}")
                .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .header("Authorization", "Bearer " + jwt))
        .andExpect(status().isNotFound());
  }

  @Test
  void putEndpoint_notAuth() throws Exception {
    String jwt = TestJwtCreator.generate("ROLE_NO_ACCESS");
    mvc.perform(
            put(FULL_NONCONTEXT_PATH)
                .content("{}")
                .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .header("Authorization", "Bearer " + jwt))
        .andExpect(status().isForbidden());
  }
}
