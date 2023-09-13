// SPDX-License-Identifier: MIT
#pragma once

extern "C" {
#include <libjsonnet.h>
}
#include <forward_list>
#include <functional>
#include <memory>
#include <optional>
#include <stdexcept>
#include <string>
#include <string_view>
#include <tuple>
#include <utility>
#include <vector>

namespace nodejsonnet {

  class JsonnetError: public std::runtime_error {
    using std::runtime_error::runtime_error;
  };

  class JsonnetVm: public std::enable_shared_from_this<JsonnetVm> {
  public:
    using NativeCallback = std::function<JsonnetJsonValue *(
      std::shared_ptr<JsonnetVm> vm, std::vector<JsonnetJsonValue const *> args)>;
    using Buffer = std::unique_ptr<char, std::function<void(char *)>>;

  private:
    JsonnetVm();
    JsonnetVm(JsonnetVm const &) = delete;
    JsonnetVm &operator=(JsonnetVm const &) = delete;

  public:
    static std::shared_ptr<JsonnetVm> make();

    ~JsonnetVm();

    void maxStack(unsigned v);
    void maxTrace(unsigned v);
    void gcMinObjects(unsigned v);
    void gcGrowthTrigger(double v);
    void stringOutput(bool v);

    void extVar(std::string const &key, std::string const &val);
    void extCode(std::string const &key, std::string const &val);
    void tlaVar(std::string const &key, std::string const &val);
    void tlaCode(std::string const &key, std::string const &val);
    void jpathAdd(std::string const &path);
    void nativeCallback(
      std::string const &name, NativeCallback cb, std::vector<std::string> const &params);

    Buffer evaluateFile(std::string const &filename) const;
    Buffer evaluateSnippet(std::string const &filename, std::string const &snippet) const;
    Buffer evaluateFileMulti(std::string const &filename) const;
    Buffer evaluateSnippetMulti(std::string const &filename, std::string const &snippet) const;
    Buffer evaluateFileStream(std::string const &filename) const;
    Buffer evaluateSnippetStream(std::string const &filename, std::string const &snippet) const;

    JsonnetJsonValue *makeJsonString(std::string const &v) const;
    JsonnetJsonValue *makeJsonNumber(double v) const;
    JsonnetJsonValue *makeJsonBool(bool v) const;
    JsonnetJsonValue *makeJsonNull() const;
    JsonnetJsonValue *makeJsonArray() const;
    void appendJsonArray(JsonnetJsonValue *array, JsonnetJsonValue *value) const;
    JsonnetJsonValue *makeJsonObject() const;
    void appendJsonObject(
      JsonnetJsonValue *array, std::string const &field, JsonnetJsonValue *value) const;
    std::optional<std::string_view> extractJsonString(JsonnetJsonValue const *json) const;
    std::optional<double> extractJsonNumber(JsonnetJsonValue const *json) const;
    std::optional<bool> extractJsonBool(JsonnetJsonValue const *json) const;
    bool extractJsonNull(JsonnetJsonValue const *json) const;

  private:
    using CallbackEntry = std::tuple<JsonnetVm *, size_t, NativeCallback>;  // [(this, arity, fun)]

    ::JsonnetVm *vm;
    std::forward_list<CallbackEntry> callbacks;

    Buffer buffer(char *buf) const;
    static JsonnetJsonValue *trampoline(
      void *ctx, JsonnetJsonValue const *const *argv, int *success);
  };

}
