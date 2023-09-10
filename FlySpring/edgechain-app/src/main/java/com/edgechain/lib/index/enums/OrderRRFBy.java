package com.edgechain.lib.index.enums;


public enum OrderRRFBy {
    DEFAULT, // Preferred Way; ordered by rrf_score;
    TEXT_RANK, // First Ordered By Text_Rank; then ordered by rrf_score
    SIMILARITY, // First Ordered by Similarity; then ordered by rrf_score
    DATE_RANK; // First Ordered by date_rank; then ordered by rrf_score;

    public static OrderRRFBy fromString(String value) {
        if (value != null) {
            for (OrderRRFBy orderRRFBy : OrderRRFBy.values()) {
                if (orderRRFBy.name().equalsIgnoreCase(value)) {
                    return orderRRFBy;
                }
            }
        }
        throw new IllegalArgumentException("Invalid OrderRRFBy value: " + value);
    }

}