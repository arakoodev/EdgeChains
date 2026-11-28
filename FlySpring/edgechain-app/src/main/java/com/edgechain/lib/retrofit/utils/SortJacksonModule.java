package com.edgechain.lib.retrofit.utils;

import com.fasterxml.jackson.core.Version;
import com.fasterxml.jackson.databind.Module;
import com.fasterxml.jackson.databind.module.SimpleDeserializers;
import com.fasterxml.jackson.databind.module.SimpleSerializers;

import org.springframework.data.domain.Sort;

/**
 * This Jackson module provides support for serializing and deserializing for Spring {@link Sort}
 * object.
 *
 * @author Can Bezmen
 */
public class SortJacksonModule extends Module {

  @Override
  public String getModuleName() {
    return "SortModule";
  }

  @Override
  public Version version() {
    return new Version(0, 1, 0, "", null, null);
  }

  @Override
  public void setupModule(SetupContext context) {
    SimpleSerializers serializers = new SimpleSerializers();
    serializers.addSerializer(Sort.class, new SortJsonComponent.SortSerializer());
    context.addSerializers(serializers);

    SimpleDeserializers deserializers = new SimpleDeserializers();
    deserializers.addDeserializer(Sort.class, new SortJsonComponent.SortDeserializer());
    context.addDeserializers(deserializers);
  }
}
