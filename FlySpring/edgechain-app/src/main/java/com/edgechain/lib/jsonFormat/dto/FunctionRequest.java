package com.edgechain.lib.jsonFormat.dto;


public class FunctionRequest {

    private String name;
    private String description;
    private Parameter parameters;

    public FunctionRequest(String name, String description, Parameter parameters) {
        this.name = name;
        this.description = description;
        this.parameters = parameters;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public Parameter getParameters() {
        return parameters;
    }

    public void setParameters(Parameter parameters) {
        this.parameters = parameters;
    }
    
}
