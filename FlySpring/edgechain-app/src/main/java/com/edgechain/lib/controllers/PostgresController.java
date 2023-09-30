package com.edgechain.lib.controllers;

import com.edgechain.lib.endpoint.impl.index.PostgresEndpoint;
import com.edgechain.lib.request.ArkRequest;
import com.edgechain.lib.response.StringResponse;
import com.edgechain.lib.rxjava.retry.impl.ExponentialDelay;

import java.util.Objects;
import java.util.concurrent.TimeUnit;

import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController("App PostgreSQLController")
@RequestMapping("/v1/postgres")
public class PostgresController {

  private PostgresEndpoint postgresEndpoint;

  private PostgresEndpoint getInstance() {
    if (Objects.isNull(postgresEndpoint))
      return postgresEndpoint =
          new PostgresEndpoint(new ExponentialDelay(3, 3, 2, TimeUnit.SECONDS));
    else return postgresEndpoint;
  }

  @DeleteMapping("/deleteAll")
  public StringResponse deletePostgres(ArkRequest arkRequest) {
    String table = arkRequest.getQueryParam("table");
    String namespace = arkRequest.getQueryParam("namespace");
    return getInstance().deleteAll(table, namespace);
  }
}
