function parseJsonnet(){
    var Jsonnet = require('jsonnet');
    // instance jsonnet
    var jsonnet = new Jsonnet();
    var fs = require('fs');
    
    var code = fs.readFileSync("./jsonnet/example1.jsonnet");
    
    // eval jsonnet to javascript object
    var result = jsonnet.eval(code);
    
    return result;
}
module.exports = parseJsonnet