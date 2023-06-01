package com.edgechain.lib.openai.plugin.tool;

public class ApiConfig {

    private String type;
    private String url;
    private Boolean has_user_authentication;
    private Boolean is_user_authenticated;

    public ApiConfig() {}

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

    public Boolean getIs_user_authenticated() {
        return is_user_authenticated;
    }

    public void setIs_user_authenticated(Boolean is_user_authenticated) {
        this.is_user_authenticated = is_user_authenticated;
    }

    @Override
    public String toString() {
        return "ApiConfig{" + "type='" + type + '\'' +
                ", url='" + url + '\'' +
                ", has_user_authentication=" + has_user_authentication +
                ", is_user_authenticated=" + is_user_authenticated +
                '}';
    }
}
