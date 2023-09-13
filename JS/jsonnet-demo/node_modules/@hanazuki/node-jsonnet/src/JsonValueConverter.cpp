// SPDX-License-Identifier: MIT
#include "JsonValueConverter.hpp"
#include <memory>
#include <utility>

namespace nodejsonnet {

  JsonValueConverter::JsonValueConverter(std::shared_ptr<JsonnetVm> vm): vm{std::move(vm)} {
  }

  Napi::Value JsonValueConverter::toNapiValue(
    Napi::Env const &env, JsonnetJsonValue const *json) const {
    if(vm->extractJsonNull(json)) {
      return env.Null();
    }
    if(auto const b = vm->extractJsonBool(json)) {
      return Napi::Boolean::New(env, *b);
    }
    if(auto const n = vm->extractJsonNumber(json)) {
      return Napi::Number::New(env, *n);
    }
    if(auto const s = vm->extractJsonString(json)) {
      return Napi::String::New(env, s->data(), s->size());
    }

    // NOTREACHED
    // Native extensions can only take primitives
    return env.Undefined();
  }

  JsonnetJsonValue *JsonValueConverter::toJsonnetJson(Napi::Value v) const {
    if(v.IsBoolean()) {
      return vm->makeJsonBool(v.As<Napi::Boolean>());
    }
    if(v.IsNumber()) {
      return vm->makeJsonNumber(v.As<Napi::Number>());
    }
    if(v.IsString()) {
      return vm->makeJsonString(v.As<Napi::String>());
    }
    if(v.IsDate()) {
      auto const toISOString = v.As<Napi::Object>().Get("toISOString").As<Napi::Function>();
      return vm->makeJsonString(toISOString.Call(v, {}).As<Napi::String>());
    }
    if(v.IsFunction() || v.IsSymbol()) {
      return vm->makeJsonNull();
    }
    if(v.IsArray()) {
      auto const array = v.As<Napi::Array>();
      auto const json = vm->makeJsonArray();
      for(size_t i = 0, len = array.Length(); i < len; ++i) {
        vm->appendJsonArray(json, toJsonnetJson(array[i]));
      }
      return json;
    }
    if(v.IsObject()) {
      auto const object = v.As<Napi::Object>();
      auto const json = vm->makeJsonObject();
      auto const props = object.GetPropertyNames();
      for(size_t i = 0, len = props.Length(); i < len; ++i) {
        auto const prop = props[i].ToString();
        if(object.HasOwnProperty(prop)) {
          vm->appendJsonObject(json, prop, toJsonnetJson(object.Get(prop)));
        }
      }
      return json;
    }
    return vm->makeJsonNull();
  }

}
