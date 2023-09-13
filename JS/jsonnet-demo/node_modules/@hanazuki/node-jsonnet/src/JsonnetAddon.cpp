// SPDX-License-Identifier: MIT
#include "JsonnetAddon.hpp"

namespace nodejsonnet {

  JsonnetAddon::JsonnetAddon(Napi::Env env, Napi::Object exports)
    : exports(Napi::Persistent(exports)) {
    DefineAddon(exports, {
                           InstanceValue("Jsonnet", nodejsonnet::Jsonnet::init(env)),
                         });
  }

  JsonnetAddon &JsonnetAddon::getInstance(Napi::Env env) {
    return *env.GetInstanceData<JsonnetAddon>();
  }

  Napi::Value JsonnetAddon::getExport(char const *name) {
    return exports.Get(name);
  }
}
