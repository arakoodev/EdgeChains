const Module = require('./lib/libjsonnet');

const Jsonnet = function Jsonnet() {
  this.libjsonnet = Module();
  this.jsonnet_make = this.libjsonnet.cwrap('jsonnet_make', 'number', []);
  this.jsonnet_realloc = this.libjsonnet.cwrap('jsonnet_realloc', 'number', ['number', 'number', 'number']);
  this.jsonnet_evaluate_snippet = this.libjsonnet.cwrap('jsonnet_evaluate_snippet', 'number', ['number', 'string', 'string', 'number']);
  this.jsonnet_destroy = this.libjsonnet.cwrap('jsonnet_destroy', 'number', ['number']);
};

module.exports = Jsonnet;

Jsonnet.prototype.eval = function ev(code) {
  const vm = this.jsonnet_make();
  const error_ptr = this.libjsonnet._malloc(4);
  const output_ptr = this.jsonnet_evaluate_snippet(vm, 'snippet', code, error_ptr);
  const error = this.libjsonnet.getValue(error_ptr, 'i32*');
  this.libjsonnet._free(error_ptr);
  const result = this.libjsonnet.UTF8ToString(output_ptr);
  this.jsonnet_realloc(vm, output_ptr, 0);
  this.jsonnet_destroy(vm);
  if (error) {
    throw result;
  }
  return JSON.parse(result);
};

