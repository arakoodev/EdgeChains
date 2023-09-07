espurify
================================

Clone new AST without extra properties

[![Build Status](https://travis-ci.org/twada/espurify.svg?branch=master)](https://travis-ci.org/twada/espurify)
[![NPM version](https://badge.fury.io/js/espurify.svg)](http://badge.fury.io/js/espurify)
[![Dependency Status](https://gemnasium.com/twada/espurify.svg)](https://gemnasium.com/twada/espurify)
[![License](http://img.shields.io/badge/license-MIT-brightgreen.svg)](http://twada.mit-license.org/)


API
---------------------------------------

### var purifiedCloneAst = espurify(originalAst)

Returns new clone of `originalAst` but without extra properties.

Leave properties defined in [Mozilla JavaScript AST spec](https://developer.mozilla.org/en-US/docs/SpiderMonkey/Parser_API) only (Note: location informations are eliminated too).


EXAMPLE
---------------------------------------

```javascript
var espurify = require('espurify'),
    estraverse = require('estraverse'),
    esprima = require('esprima'),
    syntax = estraverse.Syntax,
    assert = require('assert');

var jsCode = 'assert("foo")';

// Adding extra informations to AST
var originalAst = esprima.parse(jsCode, {tolerant: true, loc: true, raw: true});
estraverse.replace(originalAst, {
    leave: function (currentNode, parentNode) {
        if (currentNode.type === syntax.Literal && typeof currentNode.raw !== 'undefined') {
            currentNode['x-verbatim-bar'] = {
                content : currentNode.raw,
                precedence : 18  // escodegen.Precedence.Primary
            };
            return currentNode;
        } else {
            return undefined;
        }
    }
});


// purify AST
var purifiedClone = espurify(originalAst);


// original AST is not modified
assert.deepEqual(originalAst, {
  type: 'Program',
  body: [
    {
      type: 'ExpressionStatement',
      expression: {
        type: 'CallExpression',
        callee: {
          type: 'Identifier',
          name: 'assert',
          loc: {
            start: {
              line: 1,
              column: 0
            },
            end: {
              line: 1,
              column: 6
            }
          }
        },
        arguments: [
          {
            type: 'Literal',
            value: 'foo',
            raw: '"foo"',
            loc: {
              start: {
                line: 1,
                column: 7
              },
              end: {
                line: 1,
                column: 12
              }
            },
            "x-verbatim-bar": {
              content: '"foo"',
              precedence: 18
            }
          }
        ],
        loc: {
          start: {
            line: 1,
            column: 0
          },
          end: {
            line: 1,
            column: 13
          }
        }
      },
      loc: {
        start: {
          line: 1,
          column: 0
        },
        end: {
          line: 1,
          column: 13
        }
      }
    }
  ],
  loc: {
    start: {
      line: 1,
      column: 0
    },
    end: {
      line: 1,
      column: 13
    }
  },
  errors: []
});


// Extra properties are eliminated from cloned AST
assert.deepEqual(purifiedClone, {
    type: 'Program',
    body: [
        {
            type: 'ExpressionStatement',
            expression: {
                type: 'CallExpression',
                callee: {
                    type: 'Identifier',
                    name: 'assert'
                },
                arguments: [
                    {
                        type: 'Literal',
                        value: 'foo'
                    }
                ]
            }
        }
    ]
});
```


INSTALL
---------------------------------------

### via npm

Install

    $ npm install --save espurify

Use

```javascript
var espurify = require('espurify');
```

### via bower

Install

    $ bower install --save espurify

Load (`espurify` function is exported)

    <script type="text/javascript" src="./path/to/bower_components/espurify/build/espurify.js"></script>



AUTHOR
---------------------------------------
* [Takuto Wada](http://github.com/twada)


LICENSE
---------------------------------------
Licensed under the [MIT](http://twada.mit-license.org/) license.
