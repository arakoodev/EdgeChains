package com.app.openaiwiki.plugins;

import java.util.StringJoiner;

public class ApiConfig {

    private String type;
    private String url;
    private Boolean has_user_authentication = Boolean.FALSE;

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public String getUrl() {
        return url;
    }

    public void setUrl(String url) {
        this.url = url;
    }

    public Boolean getHas_user_authentication() {
        return has_user_authentication;
    }

    public void setHas_user_authentication(Boolean has_user_authentication) {
        this.has_user_authentication = has_user_authentication;
    }

    @Override
    public String toString() {
        return new StringJoiner(", ", ApiConfig.class.getSimpleName() + "[", "]")
                .add("type='" + type + "'")
                .add("url='" + url + "'")
                .add("has_user_authentication=" + has_user_authentication)
                .toString();
    }
}
