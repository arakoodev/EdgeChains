var punycode = require('punycode')

function ansiRegex () {
  const pattern = [
    '[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]+)*|[a-zA-Z\\d]+(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)',
    '(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-nq-uy=><~]))'
  ].join('|')

  return new RegExp(pattern, 'g')
}

// From https://github.com/mathiasbynens/esrever/blob/master/scripts/export-data.js

var REGEX_SYMBOLS = /([\0-\u02FF\u0370-\u1DBF\u1E00-\u20CF\u2100-\uD7FF\uDC00-\uFE1F\uFE30-\uFFFF]|[\uD800-\uDBFF][\uDC00-\uDFFF]|[\uD800-\uDBFF])([\u0300-\u036F\u1DC0-\u1DFF\u20D0-\u20FF\uFE20-\uFE2F]+)/g

exports.get = function (input) {
  if (input == null) {
    throw new Error('Missing input')
  }

  if (typeof input !== 'string') {
    throw new Error('Invalid input: ' + input)
  }

  input = input.replace(ansiRegex(), '')

  const stripped = input.replace(REGEX_SYMBOLS, function ($0, symbol, combiningMarks) {
    return symbol
  })

  return punycode.ucs2.decode(stripped).length
}

if (process.env['NODE_DEV'] === 'TEST') {
  exports.ansiRegex = ansiRegex
}
