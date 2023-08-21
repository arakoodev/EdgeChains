package com.edgechain.lib.index.enums;

public enum RedisDistanceMetric {
  L2,
  IP,
  COSINE;

  public static String getDistanceMetric(RedisDistanceMetric metric) {

    switch (metric) {
      case IP -> {
        return "IP";
      }
      case L2 -> {
        return "L2";
      }

      default -> {
        return "COSINE";
      }
    }
  }
}
