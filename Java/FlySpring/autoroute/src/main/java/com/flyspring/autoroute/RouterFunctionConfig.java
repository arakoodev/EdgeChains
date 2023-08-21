package com.flyspring.autoroute;

import java.lang.reflect.Method;
import java.util.*;
import java.util.stream.*;

import org.glowroot.agent.api.Glowroot;
import org.glowroot.agent.api.Instrumentation;
import org.glowroot.agent.api.Instrumentation.Transaction;
import org.reflections.Reflections;
import org.reflections.scanners.SubTypesScanner;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.config.AutowireCapableBeanFactory;
import org.springframework.context.annotation.*;
import org.springframework.web.reactive.function.server.RouterFunctions.Builder;

import com.flyspring.autoroute.annotations.PathVariableAnnotation;

import org.springframework.web.reactive.function.server.*;

import lombok.extern.slf4j.Slf4j;
import reactor.core.publisher.Mono;

@Slf4j
@Configuration
public class RouterFunctionConfig {

  @Autowired private AutowireCapableBeanFactory autowireCapableBeanFactory;
  private String prefix = "/route";
  private final String apiPackage = "com.application.project.myapi";

  /**
   * Register controllers' methods from package com.application.package.myapi as endpoints that
   * starts with '/route' The route is dependant on the class name and the request type is dependant
   * on the method name.
   */
  @Bean
  public RouterFunction<ServerResponse> routerFunction() {
    return RouterFunctions.route()
        .path(
            prefix,
            builder -> {
              register(builder, apiPackage);
            })
        .build();
  }

  private String getFileName(String fullName) {
    return fullName.substring(fullName.lastIndexOf(".") + 1);
  }

  /**
   * Using Builder to register controllers' methods from package com.application.project.myapi as
   * endpoints. The route is dependant on the class name and the request type is dependant on the
   * method name.
   */
  private void register(Builder builder, String packageName) {
    Reflections reflections = new Reflections(packageName, new SubTypesScanner(false));
    reflections.getSubTypesOf(Object.class).stream()
        .forEach(
            clazz -> {
              try {
                registerFile(builder, clazz, getUrlFromClassName(clazz.getName()));
              } catch (Exception e) {
                e.printStackTrace();
              }
            });
  }

  private String getUrlFromClassName(String className) {
    String withoutPrefix = className.replaceFirst(apiPackage + ".", "");
    if (!withoutPrefix.contains(".")) return "";
    String withoutFileName = withoutPrefix.substring(0, withoutPrefix.lastIndexOf("."));
    return withoutFileName.replace(".", "/");
  }

  private void registerFile(Builder builder, Class<?> clazz, String urlString) throws Exception {
    String fileName = getFileName(clazz.getName());
    System.out.println("Filename without extention: " + fileName);
    List<Method> methods =
        Stream.of(clazz.getDeclaredMethods())
            .filter(
                method ->
                    method.getName().toUpperCase().contains("FLY")
                        && !method.getName().contains("$"))
            .collect(Collectors.toList());

    String endPoint = urlString + "/" + fileName.replaceFirst("Fly", "");
    for (Method method : methods) {
      String pathVariable = "";
      System.out.println("Methods in the class: " + method.getName());
      Method classMethod = clazz.getDeclaredMethod(method.getName(), FlyRequest.class);
      if (classMethod.isAnnotationPresent(PathVariableAnnotation.class)) {
        PathVariableAnnotation annotation = classMethod.getAnnotation(PathVariableAnnotation.class);
        for (String p : annotation.name()) {
          log.info(fileName + " pathVariables:{}", p);
          pathVariable += "/" + p;
        }
      }

      String apiType = method.getName().toUpperCase().replace("FLY", "");
      log.info("APItype:{}", apiType);
      log.info("Endpoint:{}", prefix + endPoint);
      String path = endPoint + pathVariable;
      switch (apiType) {
        case "GET" -> builder.GET(
            path, req -> invokeMethod(apiType, path, req, clazz, classMethod));
        case "POST" -> builder.POST(
            path, req -> invokeMethod(apiType, path, req, clazz, classMethod));
        case "PATCH" -> builder.PATCH(
            path, req -> invokeMethod(apiType, path, req, clazz, classMethod));
        case "PUT" -> builder.PUT(
            path, req -> invokeMethod(apiType, path, req, clazz, classMethod));
        case "DELETE" -> builder.DELETE(
            path, req -> invokeMethod(apiType, path, req, clazz, classMethod));
      }
    }
  }

  @Instrumentation.Timer("FlySpring Timer")
  @Transaction(
      timer = "FlySpring Timer",
      traceHeadline = "",
      transactionName = "FlySpring",
      transactionType = "Web")
  private Mono<ServerResponse> invokeMethod(
      String apiType, String path, ServerRequest req, Class<?> clazz, Method classMethod) {
    try {
      Glowroot.setTransactionName(apiType + ":" + prefix + path);
      Object instance = clazz.getDeclaredConstructor().newInstance();
      instance = autowireCapableBeanFactory.createBean(clazz);
      autowireCapableBeanFactory.autowireBean(instance);
      Object result = classMethod.invoke(instance, new FlyRequest(req));
      if (result instanceof Mono)
        return (Mono<ServerResponse>) classMethod.invoke(instance, new FlyRequest(req));
      return ServerResponse.ok().body(Mono.just(result), classMethod.getReturnType());
    } catch (Exception e) {
      e.printStackTrace();
      return ServerResponse.ok().body(Mono.just("Exception " + apiType), String.class);
    }
  }
}
