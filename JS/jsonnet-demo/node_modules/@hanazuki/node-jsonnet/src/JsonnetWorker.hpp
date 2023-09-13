// SPDX-License-Identifier: MIT
#pragma once

#include <memory>
#include <string>
#include <napi.h>
#include "JsonnetVm.hpp"

namespace nodejsonnet {

  class JsonnetWorker: public Napi::AsyncWorker {
  public:
    struct Op {
      virtual ~Op() = default;
      virtual JsonnetVm::Buffer execute(JsonnetVm const &vm) = 0;
      virtual Napi::Value toValue(Napi::Env env, JsonnetVm::Buffer buffer) = 0;
    };

    struct EvaluateFileOp: public Op {
      explicit EvaluateFileOp(std::string filename);
      JsonnetVm::Buffer execute(JsonnetVm const &vm) override;
      Napi::Value toValue(Napi::Env env, JsonnetVm::Buffer buffer) override;

    protected:
      std::string filename;
    };

    struct EvaluateSnippetOp: public Op {
      EvaluateSnippetOp(std::string snippet, std::string filename);
      JsonnetVm::Buffer execute(JsonnetVm const &vm) override;
      Napi::Value toValue(Napi::Env env, JsonnetVm::Buffer buffer) override;

    protected:
      std::string snippet;
      std::string filename;
    };

    struct EvaluateFileMultiOp: public EvaluateFileOp {
      using EvaluateFileOp::EvaluateFileOp;
      JsonnetVm::Buffer execute(JsonnetVm const &vm) override;
      Napi::Value toValue(Napi::Env env, JsonnetVm::Buffer buffer) override;
    };

    struct EvaluateSnippetMultiOp: public EvaluateSnippetOp {
      using EvaluateSnippetOp::EvaluateSnippetOp;
      JsonnetVm::Buffer execute(JsonnetVm const &vm) override;
      Napi::Value toValue(Napi::Env env, JsonnetVm::Buffer buffer) override;
    };

    struct EvaluateFileStreamOp: public EvaluateFileOp {
      using EvaluateFileOp::EvaluateFileOp;
      JsonnetVm::Buffer execute(JsonnetVm const &vm) override;
      Napi::Value toValue(Napi::Env env, JsonnetVm::Buffer buffer) override;
    };

    struct EvaluateSnippetStreamOp: public EvaluateSnippetOp {
      using EvaluateSnippetOp::EvaluateSnippetOp;
      JsonnetVm::Buffer execute(JsonnetVm const &vm) override;
      Napi::Value toValue(Napi::Env env, JsonnetVm::Buffer buffer) override;
    };

    enum class ErrorType {
      Generic,
      Jsonnet,
    };

    JsonnetWorker(Napi::Env env, std::shared_ptr<JsonnetVm> vm, std::unique_ptr<Op> op);

    Napi::Promise Promise() {
      return deferred.Promise();
    }

  protected:
    void Execute() override;
    void OnOK() override;
    void OnError(Napi::Error const &error) override;

  private:
    std::shared_ptr<JsonnetVm> vm;
    std::unique_ptr<Op> op;
    Napi::Promise::Deferred deferred;
    JsonnetVm::Buffer result;
    ErrorType errorType;
  };

}
