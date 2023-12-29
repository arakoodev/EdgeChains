use std::fs;

use neon::prelude::*;

use jsonnet::JsonnetVm;

pub fn parse_jsonnet(
    mut cx: FunctionContext,
) -> JsResult<JsString> {
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

#[neon::main]
fn main(mut cx: ModuleContext) -> NeonResult<()> {
    cx.export_function("parseJsonnet", parse_jsonnet)?;
    Ok(())
}
