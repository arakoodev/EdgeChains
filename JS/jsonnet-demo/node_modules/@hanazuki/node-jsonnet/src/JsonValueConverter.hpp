// SPDX-License-Identifier: MIT
#pragma once
#include <memory>
#include <napi.h>
#include "JsonnetVm.hpp"

namespace nodejsonnet {

  struct JsonValueConverter {
    explicit JsonValueConverter(std::shared_ptr<JsonnetVm> vm);

    Napi::Value toNapiValue(Napi::Env const &env, JsonnetJsonValue const *json) const;
    JsonnetJsonValue *toJsonnetJson(Napi::Value v) const;

  private:
    std::shared_ptr<JsonnetVm> vm;
  };

}
