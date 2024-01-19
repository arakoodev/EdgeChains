use std::{collections::HashMap, fs};

use jsonnet::JsonnetVm;
use neon::prelude::*;
use serde_json::Value;

pub fn jsonnet(mut cx: FunctionContext) -> JsResult<JsString> {
    let path: String = cx.argument::<JsString>(0)?.value(&mut cx);
    let mut vm = JsonnetVm::new();
    let snippet = fs::read_to_string(path).unwrap();
    let output = vm.evaluate_snippet("snippet", &snippet);
    let output = match output {
        Ok(output) => output,
        Err(e) => {
            return cx.throw_error(format!("Error: {}", e));
        }
    };
    Ok(cx.string(output.to_string()))
}

pub fn jsonnet_ext_vars(mut cx: FunctionContext) -> JsResult<JsString> {
    let path: String = cx.argument::<JsString>(0)?.value(&mut cx);
    let ext_var: String = cx.argument::<JsString>(1)?.value(&mut cx);
    let mut vm = JsonnetVm::new();
    let ext_var_str = ext_var.as_str();
    let ext_vars: HashMap<&str, Value> = serde_json::from_str(ext_var_str).unwrap();
    for (key, value) in ext_vars {
        vm.ext_var(key, value.as_str().unwrap());
    }

    let snippet = fs::read_to_string(path).unwrap();

    let output = vm.evaluate_snippet("snippet", &snippet);
    let output = match output {
        Ok(output) => output,
        Err(e) => {
            return cx.throw_error(format!("{}", e));
        }
    };
    Ok(cx.string(output.to_string()))
}

#[neon::main]
fn main(mut cx: ModuleContext) -> NeonResult<()> {
    cx.export_function("jsonnet", jsonnet)?;
    cx.export_function("jsonnetExtVars", jsonnet_ext_vars)?;
    Ok(())
}
