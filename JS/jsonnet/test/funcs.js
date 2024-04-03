import Jsonnet from "../src/jsonnet.js";
// let jsonnet = new Jsonnet();
// import { CallBackClass } from "../src/jsonnet_wasm.js"
// let jsfunc = new CallBackClass();

import {jsonnet_make,jsonnet_evaluate_snippet,get_func,set_func,register_native_callback} from "../src/jsonnet_wasm.js"

// simple example

// function hello(name) {
//     console.log("hello "+JSON.parse(name).name)
// }

// jsfunc.arg = JSON.stringify({name:"afshan"})

// jsfunc.call_native_js_func(hello)

// add function 

// function add(args) {
//     let parsed = JSON.parse(args)
//     console.log(parsed)
//     return parsed.a + parsed.b;
// }

// jsfunc.arg = JSON.stringify({a:2,b:3})

// console.log(jsfunc.call_native_js_func(add))

function nativeAdd(args) {
    console.log(args)
    let sum = 0;
    let parsedArgs = JSON.parse(args);
    for(let arg of parsedArgs) {
        sum+=Number(arg);
    }
    return sum.toString();
}

let vm = jsonnet_make();
set_func("nativeAdd",(args) => {
    console.log("Args : ",args);
    return "afshan";
});
let arr = [1,2,3];
let jsonnet_code = `{
    a: 1,
    b: "hello",
    d: std.native("nativeAdd")(${arr}),
}`
let name = "nativeAdd"
register_native_callback(vm,name,3);

let result = jsonnet_evaluate_snippet(vm,"snippet",jsonnet_code);
console.log("Result : ",result);