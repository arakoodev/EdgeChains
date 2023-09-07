power-assert-formatter
================================

[![Build Status](https://travis-ci.org/twada/power-assert-formatter.svg?branch=master)](https://travis-ci.org/twada/power-assert-formatter)
[![NPM version](https://badge.fury.io/js/power-assert-formatter.svg)](http://badge.fury.io/js/power-assert-formatter)
[![Dependency Status](https://gemnasium.com/twada/power-assert-formatter.svg)](https://gemnasium.com/twada/power-assert-formatter)
[![Coverage Status](https://coveralls.io/repos/twada/power-assert-formatter/badge.png?branch=master)](https://coveralls.io/r/twada/power-assert-formatter?branch=master)

Power Assert output formatter.


DESCRIPTION
---------------------------------------
`power-assert-formatter` is a formatter for Power Assert output.

Please note that `power-assert-formatter` is a beta version product. Pull-requests, issue reports and patches are always welcomed. See [power-assert](http://github.com/twada/power-assert) project for more documentation.


CHANGELOG
---------------------------------------
See [CHANGELOG](https://github.com/twada/power-assert-formatter/blob/master/CHANGELOG.md)


API
---------------------------------------

### var createFormatter = require('power-assert-formatter');

| return type |
|:------------|
| `function`  |

Returns formatter creator function for power-assert.

### var formatter = createFormatter([options]);

| return type |
|:------------|
| `function`  |

Create formatter function with options. `options` argument is optional.

#### options

| type     | default value |
|:---------|:--------------|
| `object` | (return value of `createFormatter.defaultOptions()`) |

Configuration options. If not passed, default options will be used.

#### options.lineDiffThreshold

| type     | default value |
|:---------|:--------------|
| `number` | `5`           |

Threshold to show diff at character level or line level. If number of lines in target string is greater than `lineDiffThreshold`, then line diff mode will be used to show diff output.

#### options.maxDepth

| type     | default value |
|:---------|:--------------|
| `number` | `1`           |

Depth of object traversal. If object depth is greater than `maxDepth`, compound object (IOW, `Array` or `object`) will be pruned with `#` like `["foo",#Array#,#Object#]`.

#### options.anonymous

| type     | default value |
|:---------|:--------------|
| `string` | `"Object"`    |

Type name to show if target object is created by anonymous constructor.

#### options.circular

| type     | default value   |
|:---------|:----------------|
| `string` | `"#@Circular#"` |

Name to show if target object is detected as circular structure.

#### options.lineSeparator

| type     | default value |
|:---------|:--------------|
| `string` | `"\n"`        |

Line separator to use in power assert output.

#### options.widthOf

| type       | default value |
|:-----------|:--------------|
| `function` | [string-width.js](https://github.com/twada/power-assert-formatter/blob/master/lib/string-width.js) |

Function to calculate width of string.

#### options.stringify

| type       | default value |
|:-----------|:--------------|
| `function` | [stringifier module](https://github.com/twada/stringifier) |

Function to stringify any target value.

#### options.writerClass

| type       | default value |
|:-----------|:--------------|
| `function` | [string-writer.js](https://github.com/twada/power-assert-formatter/blob/master/lib/string-writer.js) |

Constructor Function for output writer class.

#### options.renderers

| type                | default value |
|:--------------------|:--------------|
| `Array` of `string` | shown below   |

```javascript
[
    'file',
    'assertion',
    'diagram',
    'binary-expression'
]
```

Output renderers to use. Output is rendered by renderers in order.


### var formattedText = formatter(powerAssertContext);

| return type |
|:------------|
| `string`  |

Format `powerAssertContext` into `formattedText`. `powerAssertContext` is an internal object structure, containing informations to render. Example of `powerAssertContext` is:

```javascript
{
    source: {
        content: "assert.equal(foo, bar)",
        filepath: "/path/to/some_test.js",
        line: 1
    },
    args: [
        {
            value: "foo",
            events: [
                {
                    value: "foo",
                    espath: "arguments/0"
                }
            ]
        },
        {
            value: "bar",
            events: [
                {
                    value: "bar",
                    espath: "arguments/1"
                }
            ]
        }
    ]
}
```

Note that structure of powerAssertContext may change.


INSTALL
---------------------------------------

### via npm

Install

    $ npm install --save-dev power-assert-formatter


### via bower

Install

    $ bower install --save-dev power-assert-formatter

Then load (`powerAssertFormatter` function is exported)

    <script type="text/javascript" src="./path/to/bower_components/power-assert-formatter/build/power-assert-formatter.js"></script>


AUTHOR
---------------------------------------
* [Takuto Wada](http://github.com/twada)


LICENSE
---------------------------------------
Licensed under the [MIT](https://github.com/twada/power-assert-formatter/blob/master/MIT-LICENSE.txt) license.
