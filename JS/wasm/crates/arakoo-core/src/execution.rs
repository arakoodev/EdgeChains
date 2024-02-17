use std::process;

use anyhow::{bail, Error, Result};
use apis::http::types::Response;
use javy::{json, quickjs::JSContextRef, Runtime};

pub fn run_bytecode(runtime: &Runtime, bytecode: &[u8]) {
    let context = runtime.context();

    context
        .eval_binary(bytecode)
        .and_then(|_| process_event_loop(context))
        .unwrap_or_else(handle_error);
}

#[allow(dead_code)]
pub fn invoke_entrypoint(
    runtime: &Runtime,
    bytecode: &[u8],
    input: String,
) -> anyhow::Result<Response> {
    let context = runtime.context();
    eprintln!("context.eval_binary");
    match context.eval_binary(bytecode) {
        Ok(_) => {}
        Err(e) => {
            eprintln!("error");
            eprintln!("Error while running bytecode: {e}");
            return Err(e);
        }
    }
    eprintln!("context.global_object()");
    let global = context.global_object().unwrap();
    let entry_point = global.get_property("entrypoint").unwrap();

    let request = input;
    let input_bytes = request.as_bytes();
    let input_value = json::transcode_input(context, input_bytes).unwrap_or_else(|e| {
        eprintln!("Error when transcoding input: {e}");
        process::abort();
    });
    eprintln!("entry_point.call");
    entry_point
        .call(&global, &[input_value])
        .and_then(|_| process_event_loop(context))
        .unwrap_or_else(handle_error);

    let global = context.global_object().unwrap();

    let error = global.get_property("error").unwrap();
    let output = global.get_property("result").unwrap();

    if !error.is_null_or_undefined() {
        let error = error.to_string();
        eprintln!("Error while running JS: {error}");
        process::abort();
    }
    let output = json::transcode_output(output).unwrap();
    let response: Response = serde_json::from_slice(&output).unwrap();
    Ok(response)
}

pub fn invoke_function(runtime: &Runtime, fn_module: &str, fn_name: &str) {
    let context = runtime.context();
    let js = if fn_name == "default" {
        format!("import {{ default as defaultFn }} from '{fn_module}'; defaultFn();")
    } else {
        format!("import {{ {fn_name} }} from '{fn_module}'; {fn_name}();")
    };
    context
        .eval_module("runtime.mjs", &js)
        .and_then(|_| process_event_loop(context))
        .unwrap_or_else(handle_error);
}

fn process_event_loop(context: &JSContextRef) -> Result<()> {
    if cfg!(feature = "experimental_event_loop") {
        context.execute_pending()?;
    } else if context.is_pending() {
        bail!("Adding tasks to the event queue is not supported");
    }
    Ok(())
}

fn handle_error(e: Error) {
    eprintln!("Error while running JS: {e}");
    process::abort();
}
