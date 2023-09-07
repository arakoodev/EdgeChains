var Jsonnet = require("../index");
var jsonnet = new Jsonnet();
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
    it('should return json', function(){
      var filepath = path.join(__dirname, 'src' , 'simple.jsonnet');
      var code = fs.readFileSync(filepath);
      var result = jsonnet.eval(code);
      var expected = {
        "person1": {
          "name": "Alice",
          "welcome": "Hello Alice!"
        },
        "person2": {
          "name": "Bob",
          "welcome": "Hello Bob!"
        }
      };
      assert.deepEqual(expected, result);
    })
    it('should return json from file', function(){
      var filepath = path.join(__dirname, 'src' , 'bar_menu.jsonnet');
      var result = jsonnet.evalFile(filepath);
      var expected = {
        "cocktails": {
          "Manhattan": {
            "garnish": "Maraschino Cherry",
            "ingredients": [
              {
              "kind": "Rye",
              "qty": 2.5
            },
            {
              "kind": "Sweet Red Vermouth",
              "qty": 1
            },
            {
              "kind": "Angostura",
              "qty": "dash"
            }
            ],
            "served": "Straight Up"
          },
          "Tom Collins": {
            "garnish": "Maraschino Cherry",
            "ingredients": [
              {
              "kind": "Farmers Gin",
              "qty": 1.5
            },
            {
              "kind": "Lemon",
              "qty": 1
            },
            {
              "kind": "Simple Syrup",
              "qty": 0.5
            },
            {
              "kind": "Soda",
              "qty": 2
            },
            {
              "kind": "Angostura",
              "qty": "dash"
            }
            ],
            "served": "Tall"
          }
        }
      };
      assert.deepEqual(expected, result);
    })
  })
})
