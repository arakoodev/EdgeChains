# ChangeLog

## v2.1.0 (2023-04-18)
- Update libjsonnet to [v0.20.0](https://github.com/google/jsonnet/releases/tag/v0.20.0)

## v2.0.0 (2022-10-27)

- [breaking] Node.js v10 and v12 are no longer supported.
- Update libjsonnet to [v0.19.0](https://github.com/google/jsonnet/releases/tag/v0.19.0)

## v1.0.0 (2021-12-22)
- Update libjsonnet to [v0.18.0](https://github.com/google/jsonnet/releases/tag/v0.18.0)

## v0.4.2 (2021-01-11)
- Provide ES Module interface for Node.js >= 12 ([#17](https://github.com/hanazuki/node-jsonnet/issues/17))
- Fix regression that using a native callback makes the program never finish ([#18](https://github.com/hanazuki/node-jsonnet/issues/18))

## v0.4.1 (2020-11-23)
- Update libjsonnet to [v0.17.0](https://github.com/google/jsonnet/releases/tag/v0.17.0)

## v0.4.0 (2020-09-04)
- [breaking] NAPI_VERSION >= 6 is required
- Fixed to work in multi-context application (worker threads)
- `Jsonnet.prototype.evaluate*` methods now return evaluation errors as `JsonnetError` objects

## v0.3.3 (2020-05-25)
- Update libjsonnet to [v0.16.0](https://github.com/google/jsonnet/releases/tag/v0.16.0)

## v0.3.2 (2020-05-03)
- Fixe bug where throwing in a native callback kills Node.js VM (such as `jsonnet.nativeCallback("fun", () => { throw "fail"; })`).

## v0.3.1 (2020-05-03)
- Updated dependencies.

## v0.3.0 (2020-03-13)
- Added `Jsonnet.prototype.evaluateFileMulti`, `Jsonnet.prototype.evaluateSnippetMulti`.
- Added `Jsonnet.prototype.evaluateFileStream`, `Jsonnet.prototype.evaluateSnippetStream`.
- Added `Jsonnet.prototype.stringOutput`.

## v0.2.0

## v0.1.1

## v0.1.0
