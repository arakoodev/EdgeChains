function app(){
    var Jsonnet = require('jsonnet');
    // instance jsonnet
    var jsonnet = new Jsonnet();
    var fs = require('fs');
    
    var code = fs.readFileSync("./menu.jsonnet");
    
    // eval jsonnet to javascript object
    var result = jsonnet.eval(code);
    
    return result;
}
module.exports = app