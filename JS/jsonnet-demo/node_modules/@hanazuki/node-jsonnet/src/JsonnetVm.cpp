// SPDX-License-Identifier: MIT
#include "JsonnetVm.hpp"
#include <algorithm>
#include <stdexcept>

namespace nodejsonnet {

  std::shared_ptr<JsonnetVm> JsonnetVm::make() {
    struct Constructible: public JsonnetVm {};
    return std::make_shared<Constructible>();
  }

  JsonnetVm::JsonnetVm(): vm{jsonnet_make()} {
  }

  JsonnetVm::~JsonnetVm() {
    jsonnet_destroy(vm);
  }

  void JsonnetVm::maxStack(unsigned v) {
    ::jsonnet_max_stack(vm, v);
  }

  void JsonnetVm::maxTrace(unsigned v) {
    ::jsonnet_max_trace(vm, v);
  }

  void JsonnetVm::gcMinObjects(unsigned v) {
    ::jsonnet_gc_min_objects(vm, v);
  }

  void JsonnetVm::gcGrowthTrigger(double v) {
    ::jsonnet_gc_growth_trigger(vm, v);
  }

  void JsonnetVm::stringOutput(bool v) {
    ::jsonnet_string_output(vm, v);
  }

  void JsonnetVm::extVar(std::string const &key, std::string const &val) {
    ::jsonnet_ext_var(vm, key.c_str(), val.c_str());
  }

  void JsonnetVm::extCode(std::string const &key, std::string const &val) {
    ::jsonnet_ext_code(vm, key.c_str(), val.c_str());
  }

  void JsonnetVm::tlaVar(std::string const &key, std::string const &val) {
    ::jsonnet_tla_var(vm, key.c_str(), val.c_str());
  }

  void JsonnetVm::tlaCode(std::string const &key, std::string const &val) {
    ::jsonnet_tla_code(vm, key.c_str(), val.c_str());
  }

  void JsonnetVm::jpathAdd(std::string const &path) {
    ::jsonnet_jpath_add(vm, path.c_str());
  }

  void JsonnetVm::nativeCallback(
    std::string const &name, NativeCallback cb, std::vector<std::string> const &params) {
    // Construct NULL-terminated array
    std::vector<char const *> params_cstr(params.size() + 1);
    std::transform(
      cbegin(params), cend(params), begin(params_cstr), std::mem_fn(&std::string::c_str));

    auto const ptr = &callbacks.emplace_front(this, params.size(), std::move(cb));
    ::jsonnet_native_callback(vm, name.c_str(), &trampoline, ptr, params_cstr.data());
  }

  JsonnetVm::Buffer JsonnetVm::evaluateFile(std::string const &filename) const {
    int error;
    auto result = buffer(::jsonnet_evaluate_file(vm, filename.c_str(), &error));
    if(error != 0) {
      throw JsonnetError(result.get());
    }
    return result;
  }

  JsonnetVm::Buffer JsonnetVm::evaluateSnippet(
    std::string const &filename, std::string const &snippet) const {
    int error;
    auto result = buffer(::jsonnet_evaluate_snippet(vm, filename.c_str(), snippet.c_str(), &error));
    if(error != 0) {
      throw JsonnetError(result.get());
    }
    return result;
  }

  JsonnetVm::Buffer JsonnetVm::evaluateFileMulti(std::string const &filename) const {
    int error;
    auto result = buffer(::jsonnet_evaluate_file_multi(vm, filename.c_str(), &error));
    if(error != 0) {
      throw JsonnetError(result.get());
    }
    return result;
  }

  JsonnetVm::Buffer JsonnetVm::evaluateSnippetMulti(
    std::string const &filename, std::string const &snippet) const {
    int error;
    auto result =
      buffer(::jsonnet_evaluate_snippet_multi(vm, filename.c_str(), snippet.c_str(), &error));
    if(error != 0) {
      throw JsonnetError(result.get());
    }
    return result;
  }

  JsonnetVm::Buffer JsonnetVm::evaluateFileStream(std::string const &filename) const {
    int error;
    auto result = buffer(::jsonnet_evaluate_file_stream(vm, filename.c_str(), &error));
    if(error != 0) {
      throw JsonnetError(result.get());
    }
    return result;
  }

  JsonnetVm::Buffer JsonnetVm::evaluateSnippetStream(
    std::string const &filename, std::string const &snippet) const {
    int error;
    auto result =
      buffer(::jsonnet_evaluate_snippet_stream(vm, filename.c_str(), snippet.c_str(), &error));
    if(error != 0) {
      throw JsonnetError(result.get());
    }
    return result;
  }

  JsonnetJsonValue *JsonnetVm::makeJsonString(std::string const &v) const {
    return ::jsonnet_json_make_string(vm, v.c_str());
  }

  JsonnetJsonValue *JsonnetVm::makeJsonNumber(double v) const {
    return ::jsonnet_json_make_number(vm, v);
  }

  JsonnetJsonValue *JsonnetVm::makeJsonBool(bool v) const {
    return ::jsonnet_json_make_bool(vm, v);
  }

  JsonnetJsonValue *JsonnetVm::makeJsonNull() const {
    return ::jsonnet_json_make_null(vm);
  }

  JsonnetJsonValue *JsonnetVm::makeJsonArray() const {
    return ::jsonnet_json_make_array(vm);
  }

  void JsonnetVm::appendJsonArray(JsonnetJsonValue *array, JsonnetJsonValue *value) const {
    ::jsonnet_json_array_append(vm, array, value);
  }

  JsonnetJsonValue *JsonnetVm::makeJsonObject() const {
    return ::jsonnet_json_make_object(vm);
  }

  void JsonnetVm::appendJsonObject(
    JsonnetJsonValue *array, std::string const &field, JsonnetJsonValue *value) const {
    ::jsonnet_json_object_append(vm, array, field.c_str(), value);
  }

  std::optional<std::string_view> JsonnetVm::extractJsonString(JsonnetJsonValue const *json) const {
    if(auto const p = ::jsonnet_json_extract_string(vm, json)) {
      return p;
    }
    return std::nullopt;
  }

  std::optional<double> JsonnetVm::extractJsonNumber(JsonnetJsonValue const *json) const {
    if(double n; ::jsonnet_json_extract_number(vm, json, &n)) {
      return n;
    }
    return std::nullopt;
  }

  std::optional<bool> JsonnetVm::extractJsonBool(JsonnetJsonValue const *json) const {
    switch(::jsonnet_json_extract_bool(vm, json)) {
    case 0:
      return false;
    case 1:
      return true;
    default:
      return std::nullopt;
    }
  }

  bool JsonnetVm::extractJsonNull(JsonnetJsonValue const *json) const {
    return ::jsonnet_json_extract_null(vm, json);
  }

  JsonnetVm::Buffer JsonnetVm::buffer(char *buf) const {
    return {buf, [self = shared_from_this()](char *buf) { ::jsonnet_realloc(self->vm, buf, 0); }};
  }

  JsonnetJsonValue *JsonnetVm::trampoline(
    void *ctx, JsonnetJsonValue const *const *argv, int *success) {
    auto const &[vm, arity, func] = *static_cast<CallbackEntry *>(ctx);

    try {
      auto result = func(vm->shared_from_this(), {argv, argv + arity});
      *success = 1;
      return result;
    } catch(std::exception const &e) {
      *success = 0;
      return vm->makeJsonString(e.what());
    }
  }

}
