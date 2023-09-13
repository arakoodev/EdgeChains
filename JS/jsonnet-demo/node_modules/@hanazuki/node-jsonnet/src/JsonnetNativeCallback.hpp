// SPDX-License-Identifier: MIT
#pragma once

extern "C" {
#include <libjsonnet.h>
}
#include <future>
#include <memory>
#include <napi.h>

#include "JsonValueConverter.hpp"

namespace nodejsonnet {

  class JsonnetNativeCallback {
  public:
    JsonnetNativeCallback(Napi::Env env, Napi::Function fun);
    ~JsonnetNativeCallback();

    JsonnetNativeCallback(JsonnetNativeCallback const &) = delete;
    JsonnetNativeCallback &operator=(JsonnetNativeCallback const &) = delete;

    JsonnetJsonValue *call(
      std::shared_ptr<JsonnetVm> vm, std::vector<JsonnetJsonValue const *> args);

  private:
    struct Payload {
      Payload(std::shared_ptr<JsonnetVm> vm, std::vector<JsonnetJsonValue const *> args)
        : args{std::move(args)}, vm{std::move(vm)} {
      }

      std::vector<JsonnetJsonValue const *> const &getArgs() const {
        return args;
      }

      std::shared_ptr<JsonnetVm> getVm() const {
        return vm;
      }

      void setResult(JsonnetJsonValue *value) {
        result.set_value(value);
      }

      void setError(std::exception_ptr e) {
        result.set_exception(e);
      }

      std::future<JsonnetJsonValue *> getFuture() {
        return result.get_future();
      }

    private:
      std::vector<JsonnetJsonValue const *> args;
      std::shared_ptr<JsonnetVm> vm;
      std::promise<JsonnetJsonValue *> result;
    };

    static void callback(Napi::Env env, Napi::Function fun, std::nullptr_t *, Payload *payload);

    using ThreadSafeFunction = Napi::TypedThreadSafeFunction<std::nullptr_t, Payload, callback>;

    ThreadSafeFunction tsfn;
  };

}
