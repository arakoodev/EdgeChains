package com.edgechain.lib.request;

import com.edgechain.lib.request.exception.InvalidArkRequest;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.*;
import org.json.JSONObject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.io.BufferedReader;
import java.io.IOException;
import java.security.Principal;
import java.util.Collection;
import java.util.Enumeration;
import java.util.Objects;

public class ArkRequest {

  private final HttpServletRequest request;

  private static final Logger logger = LoggerFactory.getLogger(ArkRequest.class);

  public ArkRequest() {
    this.request =
        ((ServletRequestAttributes)
                Objects.requireNonNull(RequestContextHolder.getRequestAttributes()))
            .getRequest();

    String contentType = request.getContentType();

    if (Objects.isNull(contentType)) {
      logger.error(
          "ArkRequest can only accept Content-Type:application/json ||"
              + " Content-Type:multipart/form-data - You haven't specified Content-Type");

      throw new InvalidArkRequest(
          "ArkRequest can only accept Content-Type:application/json ||"
              + " Content-Type:multipart/form-data - You haven't specified Content-Type");
    } else if (!contentType.contains("application/json")
        && !contentType.contains("multipart/form-data")) {
      logger.error(
          "ArkRequest can only accept Content-Type:application/json ||"
              + " Content-Type:multipart/form-data");

      throw new InvalidArkRequest(
          "ArkRequest can only accept Content-Type:application/json ||"
              + " Content-Type:multipart/form-data");
    }
  }

  public String getContentType() {
    return this.request.getContentType();
  }

  public String getHeader(String key) {
    return this.request.getHeader(key);
  }

  public Enumeration<String> getHeaders(String key) {
    return this.request.getHeaders(key);
  }

  public Enumeration<String> getHeaderNames() {
    return this.request.getHeaderNames();
  }

  public long getDateHeader(String key) {
    return this.request.getDateHeader(key);
  }

  public int getIntHeader(String key) {
    return this.request.getIntHeader(key);
  }

  public boolean getBooleanHeader(String key) {
    return Boolean.parseBoolean(this.getHeader(key));
  }

  public String getContextPath() {
    return this.request.getContextPath();
  }

  public String getRequestURI() {
    return this.request.getRequestURI();
  }

  public String getQueryString() {
    return this.request.getQueryString();
  }

  public String getQueryParam(String key) {
    return this.request.getParameter(key);
  }

  public int getIntQueryParam(String key) {
    return Integer.parseInt(this.request.getParameter(key));
  }

  public JSONObject getBody() {

    StringBuilder jsonContent = new StringBuilder();

    try (BufferedReader reader = request.getReader()) {
      String line;
      while ((line = reader.readLine()) != null) {
        jsonContent.append(line);
      }
      return new JSONObject(jsonContent.toString());
    } catch (IOException e) {
      throw new RuntimeException(e);
    }
  }

  public Cookie[] getCookies() {
    return this.request.getCookies();
  }

  public Part getMultiPart(String name) {
    try {
      return this.request.getPart(name);
    } catch (IOException | ServletException e) {
      throw new RuntimeException(e);
    }
  }

  public Collection<Part> getMultiParts() {
    try {
      return this.request.getParts();
    } catch (IOException | ServletException e) {
      throw new RuntimeException(e);
    }
  }

  public Principal getPrincipal() {
    return this.request.getUserPrincipal();
  }

  public String getMethodName() {
    return this.request.getMethod();
  }

  public HttpServletRequest getRequest() {
    return request;
  }
}
