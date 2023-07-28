package com.edgechain.lib.jsonFormat.dto;

public class MultiplePromptRequest {
    
    private String situation;
    private String validAction;
    private String callToAction;
    private String actionFormat;

    public String getSituation() {
        return situation;
    }
    public void setSituation(String situation) {
        this.situation = situation;
    }
    public String getValidAction() {
        return validAction;
    }
    public void setValidAction(String validAction) {
        this.validAction = validAction;
    }
    public String getCallToAction() {
        return callToAction;
    }
    public void setCallToAction(String callToAction) {
        this.callToAction = callToAction;
    }
    public String getActionFormat() {
        return actionFormat;
    }
    public void setActionFormat(String actionFormat) {
        this.actionFormat = actionFormat;
    }
   
}
