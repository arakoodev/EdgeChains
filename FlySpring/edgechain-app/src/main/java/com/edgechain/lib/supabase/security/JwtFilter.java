package com.edgechain.lib.supabase.security;

import com.edgechain.lib.configuration.WebConfiguration;
import com.edgechain.lib.configuration.domain.SecurityUUID;
import com.edgechain.lib.exceptions.response.ErrorResponse;
import com.edgechain.lib.supabase.entities.User;
import com.edgechain.lib.supabase.exceptions.FilterException;
import com.edgechain.lib.supabase.utils.AuthUtils;
import com.edgechain.lib.utils.JsonUtils;
import io.jsonwebtoken.*;
import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Objects;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class JwtFilter extends OncePerRequestFilter {

  @Autowired private JwtHelper jwtHelper;

  @Autowired private UserSecurityService userSecurityService;

  @Autowired private SecurityUUID securityUUID;

  @Override
  protected void doFilterInternal(
      HttpServletRequest request, HttpServletResponse response, FilterChain filter)
      throws ServletException, IOException {

    if (request.getRequestURI().startsWith(WebConfiguration.CONTEXT_PATH)) {
      String authHeader = request.getHeader("Authorization");
      if (Objects.isNull(authHeader) || !authHeader.equals(securityUUID.getAuthKey()))
        throw new FilterException("Access Denied");
    }

    String token = AuthUtils.extractToken(request);

    if (token != null) {

      /** If you are using Supabase, then uncomment this line; * */
      //      User user = userSecurityService.loadUserByUsername(token);

      /**
       * Because, EdgeChains is a project independent of supabase; therefore, your jwt must contain
       * these two fields: a) email: "", b) role: "authenticated, user_create"
       */
      Jws<Claims> claimsJws;
      try {
        claimsJws = jwtHelper.parseToken(token);
      } catch (final Exception e) {
        // use Spring Security logger here instead of SLF4J
        logger.info("JWT not accepted: %s".formatted(e.getMessage()));

        ErrorResponse errorResponse = new ErrorResponse(e.getMessage());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.getWriter().print(JsonUtils.convertToString(errorResponse));
        response.setStatus(HttpStatus.UNAUTHORIZED.value());
        return;
      }

      String email = (String) claimsJws.getBody().get("email");
      String role = (String) claimsJws.getBody().get("role");

      // use Spring Security logger here instead of SLF4J
      logger.info("JWT email=%s role=%s".formatted(email, role));

      User user = new User();
      user.setEmail(email);
      user.setAccessToken(token);
      user.setRole(role);

      UsernamePasswordAuthenticationToken authToken =
          new UsernamePasswordAuthenticationToken(user, null, user.getAuthorities());
      SecurityContextHolder.getContext().setAuthentication(authToken);
    }

    filter.doFilter(request, response);
  }
}
