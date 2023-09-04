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
class WebSecurityTest {

  private static final String FULL_CONTEXT_PATH = WebConfiguration.CONTEXT_PATH + "/";
  private static final String FULL_NONCONTEXT_PATH = "/v0/endpoint/";

  private static String testJwt;
  private static String jwtHeaderVal;

  @BeforeAll
  static void setupAll() {
    System.setProperty("jwt.secret", "edge-chain-unit-test-jwt-secret");
    testJwt = generateJwt();
    jwtHeaderVal = "Bearer " + testJwt;
  }

  private static String generateJwt() {
    Algorithm algo = Algorithm.HMAC256(System.getProperty("jwt.secret").getBytes());
    Date d = new Date();
    return JWT.create()
        .withSubject("example JWT for testing")
        .withClaim("email", "admin@machine.local")
        .withClaim("role", "ROLE_ANONYMOUS")
        .withIssuer("edgechain-tester")
        .withIssuedAt(d)
        .withExpiresAt(new Date(d.getTime() + 25000))
        .sign(algo);
  }

  @Autowired
  private MockMvc mvc;

  @Autowired
  private SecurityUUID securityUUID;
  
  @Autowired
  private JwtHelper jwtHelper;

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

  // ====== TEST JWT-BASED SECURITY (bearer token must be in header) ======
  
  @Test
  void validateJwt() {
    assertTrue(jwtHelper.validate(testJwt));
  }

  @Test
  void getNonContextEndpoint() throws Exception {
    
    mvc.perform(
        get(FULL_NONCONTEXT_PATH)
            .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
            .header("Authorization", jwtHeaderVal))
        .andExpect(status().isNotFound());
  }

  @Test
  void postNonContextEndpoint() throws Exception {
    mvc.perform(
        post(FULL_NONCONTEXT_PATH)
            .content("{}")
            .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
            .header("Authorization", jwtHeaderVal))
        .andExpect(status().isNotFound());
  }

  @Test
  void deleteNonContextEndpoint() throws Exception {
    mvc.perform(
        delete(FULL_NONCONTEXT_PATH)
            .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
            .header("Authorization", jwtHeaderVal))
        .andExpect(status().isNotFound());
  }

  @Test
  void patchNonContextEndpoint() throws Exception {
    mvc.perform(
        patch(FULL_NONCONTEXT_PATH)
            .content("{}")
            .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
            .header("Authorization", jwtHeaderVal))
        .andExpect(status().isNotFound());
  }

  @Test
  void putNonContextEndpoint() throws Exception {
    mvc.perform(
        put(FULL_NONCONTEXT_PATH)
            .content("{}")
            .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
            .header("Authorization", jwtHeaderVal))
        .andExpect(status().isNotFound());
  }

}
