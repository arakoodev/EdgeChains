package com.application.project.myapi;

import com.flyspring.autoroute.FlyRequest;
import com.flyspring.autoroute.annotations.PathVariableAnnotation;

public class Flymsg {

  @PathVariableAnnotation(name = {"{msg}"})
  public String flyget(FlyRequest request) {
    return request.getPathVariable("msg");
  }
}
