// SPDX-License-Identifier: MIT
#include "JsonnetNativeCallback.hpp"

namespace nodejsonnet {

  JsonnetNativeCallback::JsonnetNativeCallback(Napi::Env env, Napi::Function fun)
    : tsfn{ThreadSafeFunction::New(env, fun, "Jsonnet Native Callback", 0, 1)} {
  }

  JsonnetNativeCallback::~JsonnetNativeCallback() {
    this->tsfn.Release();
  }

  JsonnetJsonValue *JsonnetNativeCallback::call(
    std::shared_ptr<JsonnetVm> vm, std::vector<JsonnetJsonValue const *> args) {
    // This functions runs in a worker thread and cannot access Node VM.

    Payload payload(std::move(vm), std::move(args));
    tsfn.BlockingCall(&payload);
    return payload.getFuture().get();
  }

  void JsonnetNativeCallback::callback(
    Napi::Env env, Napi::Function fun, std::nullptr_t *, Payload *payload) {
    // This functions runs in the Node main thread.

    JsonValueConverter const conv{payload->getVm()};

    std::vector<napi_value> args;
    args.reserve(payload->getArgs().size());
    for(auto const arg: payload->getArgs()) {
      args.push_back(conv.toNapiValue(env, arg));
    }

    auto const result = fun.Call(args);
    if(!result.IsPromise()) {
      payload->setResult(conv.toJsonnetJson(result));
      return;
    }

    auto const on_success = Napi::Function::New(
      env,
      [](Napi::CallbackInfo const &info) {
        auto const payload = static_cast<Payload *>(info.Data());
        JsonValueConverter const conv{payload->getVm()};
        payload->setResult(conv.toJsonnetJson(info[0]));
      },
      "onSuccess", payload);

    auto const on_failure = Napi::Function::New(
      env,
      [](Napi::CallbackInfo const &info) {
        auto const payload = static_cast<Payload *>(info.Data());
        auto const error = info[0].ToString();
        payload->setError(std::make_exception_ptr(std::runtime_error(error)));
      },
      "onFailure", payload);

    auto const promise = result.As<Napi::Object>();
    promise.Get("then").As<Napi::Function>().Call(promise, {on_success, on_failure});
  }

}
