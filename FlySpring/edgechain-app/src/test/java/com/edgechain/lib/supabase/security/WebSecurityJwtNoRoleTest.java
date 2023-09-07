package com.edgechain.lib.supabase.security;

import com.edgechain.testutil.TestJwtCreator;
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
class WebSecurityJwtNoRoleTest {

  // ====== TEST JWT-BASED SECURITY WITH NO ROLES (bearer token must be in header) ======

  private static final String FULL_NONCONTEXT_PATH = "/v0/endpoint/";

  @BeforeAll
  static void setupAll() {
    System.setProperty("jwt.secret", "edge-chain-unit-test-jwt-secret");
  }

  @Autowired private MockMvc mvc;

  @Autowired private JwtHelper jwtHelper;

  @Test
  void validateJwt() {
    String jwt = TestJwtCreator.generate("ROLE_IGNORED");
    assertTrue(jwtHelper.validate(jwt));
  }

  @Test
  void getEndpoint() throws Exception {
    String jwt = TestJwtCreator.generate("ROLE_IGNORED");
    mvc.perform(
            get(FULL_NONCONTEXT_PATH)
                .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .header("Authorization", "Bearer " + jwt))
        .andExpect(status().isNotFound());
  }

  @Test
  void postEndpoint() throws Exception {
    String jwt = TestJwtCreator.generate("ROLE_IGNORED");
    mvc.perform(
            post(FULL_NONCONTEXT_PATH)
                .content("{}")
                .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .header("Authorization", "Bearer " + jwt))
        .andExpect(status().isNotFound());
  }

  @Test
  void deleteEndpoint() throws Exception {
    String jwt = TestJwtCreator.generate("ROLE_IGNORED");
    mvc.perform(
            delete(FULL_NONCONTEXT_PATH)
                .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .header("Authorization", "Bearer " + jwt))
        .andExpect(status().isNotFound());
  }

  @Test
  void patchEndpoint() throws Exception {
    String jwt = TestJwtCreator.generate("ROLE_IGNORED");
    mvc.perform(
            patch(FULL_NONCONTEXT_PATH)
                .content("{}")
                .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .header("Authorization", "Bearer " + jwt))
        .andExpect(status().isNotFound());
  }

  @Test
  void putEndpoint() throws Exception {
    String jwt = TestJwtCreator.generate("ROLE_IGNORED");
    mvc.perform(
            put(FULL_NONCONTEXT_PATH)
                .content("{}")
                .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .header("Authorization", "Bearer " + jwt))
        .andExpect(status().isNotFound());
  }
}
