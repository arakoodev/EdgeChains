package com.edgechain.lib.jsonnet.mapper;

import com.edgechain.lib.configuration.context.ApplicationContextHolder;
import com.edgechain.lib.jsonnet.exceptions.UnexpectedServiceException;
import com.edgechain.lib.jsonnet.schemas.Schema;

import java.util.Iterator;


public class ServiceMapper {

    public <T> T map(Schema schema, String name, Class<T> classType){

        Iterator<String> iterator = schema.getServices().iterator();
        while (iterator.hasNext()) {
            String service = iterator.next();
            if(service.equals(name)) {
                return ApplicationContextHolder.getContext().getBean(classType);
            }

        }

        throw new UnexpectedServiceException(String.format("%s service is not defined in jsonnet",name));
    }

}
