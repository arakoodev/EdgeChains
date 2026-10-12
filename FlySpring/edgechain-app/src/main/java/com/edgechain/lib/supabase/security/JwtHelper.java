package com.edgechain.lib.supabase.security;

import io.jsonwebtoken.*;
import java.security.Key;
import java.util.Objects;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

@Component
public class JwtHelper {

  @Autowired private Environment env;

  public Jws<Claims> parseToken(String accessToken) {
    try {
      final String secret = env.getProperty("jwt.secret");
      Objects.requireNonNull(secret, "JWT secret not set");
      final byte[] bytes = secret.getBytes();
      final Key hmacKey = new SecretKeySpec(bytes, SignatureAlgorithm.HS256.getJcaName());
      return Jwts.parser().setSigningKey(hmacKey).parseClaimsJws(accessToken);

    } catch (MalformedJwtException e) {
      throw new JwtException("Token Malformed");
    } catch (UnsupportedJwtException e) {
      throw new JwtException("Token Unsupported");
    } catch (ExpiredJwtException e) {
      throw new JwtException("Token Expired");
    } catch (IllegalArgumentException e) {
      throw new JwtException("Token Empty");
    } catch (SignatureException e) {
      throw new JwtException("Token Signature Failed");
    }
  }

  public boolean validate(String accessToken) {
    try {
      parseToken(accessToken);
      return true;
    } catch (JwtException e) {
      return false;
    }
  }
}
