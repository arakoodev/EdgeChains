package com.edgechain.lib.jsonFormat.dto;

public class Parameter {

    private String type;
    private Object properties;
    
    public Parameter(String type, Object properties) {
        this.type = type;
        this.properties = properties;
    }

    public String getType() {
        return type;
    }
    public void setType(String type) {
        this.type = type;
    }
    public Object getProperties() {
        return properties;
    }
    public void setProperties(Object properties) {
        this.properties = properties;
    }
    
}
