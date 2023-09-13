'use strict'

const path = require('path');
const symbols = require('./symbols')

const include_dir = path.resolve(__dirname, 'include');

module.exports = {
    include_dir,
    symbols
}
