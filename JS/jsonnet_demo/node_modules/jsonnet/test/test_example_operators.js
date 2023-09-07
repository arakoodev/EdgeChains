var Jsonnet = require("../index");
var jsonnet = null;
var fs = require('fs');
var path = require('path');
var assert = require('power-assert');

describe('jsonnet', function(){
  before('create jsonnet', function() {
    jsonnet = new Jsonnet();
  });
  after('destroy jsonnet', function() {
    jsonnet.destroy();
  })
  describe('#eval()', function(){
    it('should return example_operators json', function(){
      var filepath = path.join(__dirname, 'src' , 'example_operators.jsonnet');
      var expectedPath = path.join(__dirname, 'expected' , 'example_operators.json');
      var result = jsonnet.evalFile(filepath);
      var expected = JSON.parse(fs.readFileSync(expectedPath));
      assert.deepEqual(expected, result);
    })
  })
})

