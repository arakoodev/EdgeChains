package com.edgechain.lib.index.enums;

public enum PostgresDistanceMetric {
  L2,
  IP,
  COSINE;

  public static String getDistanceMetric(PostgresDistanceMetric metric) {

    switch (metric) {
      case IP -> {
        return "<#>";
      }
      case COSINE -> {
        return "<=>";
      }

      default -> {
        return "<->";
      }
    }
  }
}
