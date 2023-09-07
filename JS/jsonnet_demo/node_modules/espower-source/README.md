espower-source
================================

[![Build Status](https://travis-ci.org/twada/espower-source.svg?branch=master)](https://travis-ci.org/twada/espower-source)
[![NPM version](https://badge.fury.io/js/espower-source.svg)](http://badge.fury.io/js/espower-source)
[![Dependency Status](https://gemnasium.com/twada/espower-source.svg)](https://gemnasium.com/twada/espower-source)

Power Assert instrumentor from code to code, with SourceMap.


DESCRIPTION
---------------------------------------
`espower-source` is a source code transformer that applies [espower](http://github.com/twada/espower) to target code.

`espower` manipulates assertion expression (JavaScript Code) represented as [Mozilla JavaScript AST](https://developer.mozilla.org/en-US/docs/SpiderMonkey/Parser_API), to instrument power-assert feature into the code. SourceMap information is appended in SourceMap Comment syntax at the end of returned code.

Please note that `espower-source` is a beta version product. Pull-requests, issue reports and patches are always welcomed.

See [power-assert](http://github.com/twada/power-assert) project for more documentation.


CHANGELOG
---------------------------------------
See [CHANGELOG](https://github.com/twada/espower-source/blob/master/CHANGELOG.md)


API
---------------------------------------

### var modifiedCode = espowerSource(originalCode, filepath, [options])

| return type |
|:------------|
| `string`    |

`espowerSource` function manipulates `originalCode` then returns (transformed) JavaScript code as string. SourceMap information is appended in SourceMap Comment syntax at the end of returned code.

#### originalCode

| type     | default value |
|:---------|:--------------|
| `string` | N/A           |

Original JavaScript source code that is a source of code transformation.

#### filepath

| type     | default value |
|:---------|:--------------|
| `string` | N/A           |

Filepath of `originalCode`. If passed, espowerSource stores filepath information for later reporting.

#### options

| type     | default value |
|:---------|:--------------|
| `object` | (return value of `espower.defaultOptions()` but with `destructive` option is `true`) |

Configuration options for `espower` module. If not passed, default options (Same as [espower.defaultOptions()](https://github.com/twada/espower#var-options--espowerdefaultoptions)) will be used, but `destructive` option is set to `true` by espower-source module.


AUTHOR
---------------------------------------
* [Takuto Wada](http://github.com/twada)


CONTRIBUTORS
---------------------------------------
* [azu](https://github.com/azu)


LICENSE
---------------------------------------
Licensed under the [MIT](https://github.com/twada/espower-source/blob/master/MIT-LICENSE.txt) license.
