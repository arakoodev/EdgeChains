package com.edgechain.lib.jsonFormat.dto;


public class Schema {
    private String name;
    private String description;
    private ParametersDTO parameters;

    public Schema(String name, String description, ParametersDTO parameters) {
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

    public ParametersDTO getParameters() {
        return parameters;
    }

    public void setParameters(ParametersDTO parameters) {
        this.parameters = parameters;
    }

    public static class ParametersDTO {
        private String type;
        private String properties;

        public ParametersDTO(String type, String properties) {
            this.type = type;
            this.properties = properties;
        }

        public String getType() {
            return type;
        }

        public void setType(String type) {
            this.type = type;
        }

        public String getProperties() {
            return properties;
        }

        public void setProperties(String properties) {
            this.properties = properties;
        }
    }

}