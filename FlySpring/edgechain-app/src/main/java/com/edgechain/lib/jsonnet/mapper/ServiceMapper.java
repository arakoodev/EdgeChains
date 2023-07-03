package com.edgechain.lib.jsonnet.mapper;

import com.edgechain.lib.configuration.context.ApplicationContextHolder;
import com.edgechain.lib.jsonnet.JsonnetLoader;
import com.edgechain.lib.jsonnet.exceptions.UnexpectedServiceException;

import java.util.Iterator;

public class ServiceMapper {

  public <T> T map(JsonnetLoader loader, String name, Class<T> classType) {

    Iterator<Object> iterator = loader.getArray("services").iterator();
    while (iterator.hasNext()) {
      String service = (String) iterator.next();
      if (service.equals(name)) {
        return ApplicationContextHolder.getContext().getBean(classType);
      }
    }

    throw new UnexpectedServiceException(
        String.format("%s service is not defined in jsonnet", name));
  }
}
