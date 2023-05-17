package com.flyspring.autoroute;

import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jwt.Jwt;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class AudienceValidatorTest {
  @Test
  public void testValidate_validAudience() {
    String audience = "my-audience";
    Jwt jwt = createValidJwt(audience);
    AudienceValidator validator = new AudienceValidator(audience);

    OAuth2TokenValidatorResult result = validator.validate(jwt);
    System.out.println(jwt.getAudience().get(0).toLowerCase());
    assertFalse(result.hasErrors());
  }

  @Test
  public void testValidate_missingAudience() {
    String audience = "my-audience";
    Jwt jwt = createValidJwt("other-audience");
    AudienceValidator validator = new AudienceValidator(audience);

    OAuth2TokenValidatorResult result = validator.validate(jwt);

    assertTrue(result.hasErrors());
    assertEquals("invalid_token", result.getErrors().iterator().next().getErrorCode());
  }

  @Test
  public void testValidate_multipleAudiences() {
    String audience = "my-audience";
    Jwt jwt = createValidJwt("other-audience", audience, "third-audience");
    AudienceValidator validator = new AudienceValidator(audience);

    OAuth2TokenValidatorResult result = validator.validate(jwt);

    assertFalse(result.hasErrors());
  }

  @Test
  public void testValidate_emptyAudience() {
    String audience = "";
    Jwt jwt = createValidJwt(audience);
    AudienceValidator validator = new AudienceValidator(audience);

    OAuth2TokenValidatorResult result = validator.validate(jwt);

    assertFalse(result.hasErrors());
  }

  private Jwt createValidJwt(String... audience) {
    Instant now = Instant.now();
    Instant expiresAt = now.plus(Duration.ofHours(1));

    Jwt jwt =
        Jwt.withTokenValue("test-token-value")
            .header("alg", "RS256")
            .claim("iss", "test-issuer")
            .claim("sub", "test-subject")
            .audience(List.of(audience))
            .issuedAt(now)
            .expiresAt(expiresAt)
            .build();

    return jwt;
  }
}
