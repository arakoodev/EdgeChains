package com.edgechain.lib.jsonFormat.request;

public class Parameters {

    private String type;
    private Property properties;

    public Parameters() {
    }

    public Parameters(String type, Property properties) {
        this.type = type;
        this.properties = properties;
    }
    
    public String getType() {
        return type;
    }
    public void setType(String type) {
        this.type = type;
    }
    public Property getProperties() {
        return properties;
    }

    public void setProperties(Property properties) {
        this.properties = properties;
    }

    @Override
    public String toString() {
        return "Parameters [type=" + type + ", properties=" + properties + "]";
    }

    public static class Property {

        private Types items;

        public Property() {
        }

        public Property(Types items) {
            this.items = items;
        }

        public Types getItems() {
            return items;
        }

        public void setItems(Types items) {
            this.items = items;
        }
        
        public static class Types {
            private String type;

            public Types() {
            }

            public Types(String type) {
                this.type = type;
            }

            public String getType() {
                return type;
            }

            public void setType(String type) {
                this.type = type;
            }
            
        }

        
    }
    
    
}
