package com.edgechain.testutil;

import com.auth0.jwt.JWT;
import com.auth0.jwt.algorithms.Algorithm;
import java.util.Date;

public final class TestJwtCreator {

  private TestJwtCreator() {
    // no
  }

  public static String generate(String role) {
    Algorithm algo = Algorithm.HMAC256(System.getProperty("jwt.secret").getBytes());
    Date d = new Date();
    return JWT.create()
        .withSubject("example JWT for testing")
        .withClaim("email", "admin@machine.local")
        .withClaim("role", role)
        .withIssuer("edgechain-tester")
        .withIssuedAt(d)
        .withExpiresAt(new Date(d.getTime() + 25000))
        .sign(algo);
  }
}
