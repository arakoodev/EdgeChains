package com.edgechain.lib.openai.request;

import org.json.JSONObject;

public class Parameters {

    private String type;
    private JSONObject properties;

    public Parameters(String type, JSONObject properties) {
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
    public void setProperties(JSONObject properties) {
        this.properties = properties;
    }

    
    
}