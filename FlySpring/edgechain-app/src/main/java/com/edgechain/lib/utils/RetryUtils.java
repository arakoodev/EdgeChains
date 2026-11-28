package com.edgechain.lib.utils;

import com.edgechain.lib.endpoint.Endpoint;

import java.util.Objects;

public class RetryUtils {

  public static boolean available(Endpoint endpoint) {
    if (Objects.isNull(endpoint) || Objects.isNull(endpoint.getRetryPolicy())) return false;
    return true;
  }
}
