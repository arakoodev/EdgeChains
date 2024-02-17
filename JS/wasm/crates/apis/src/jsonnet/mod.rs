use javy::quickjs::{JSContextRef, JSValue, JSValueRef};

use crate::{jsonnet_evaluate, jsonnet_output, jsonnet_output_len, JSApiSet};

static JSONNET: &str = include_str!("./index.js");

pub(super) struct Jsonnet;

impl JSApiSet for Jsonnet {
    fn register(&self, runtime: &javy::Runtime, _config: &crate::APIConfig) -> anyhow::Result<()> {
        let context = runtime.context();
        let global = context.global_object()?;
        eprintln!("Registering jsonnet");
        global.set_property(
            "__jsonnet_evaluate_snippet",
            context.wrap_callback(jsonnet_evaluate_snippet_callback())?,
        )?;

        match context.eval_module("arakoo-jsonnet", JSONNET) {
            Ok(_) => {}
            Err(err) => eprintln!("Error loading the path shim: {err}"),
        };
        Ok(())
    }
}

fn jsonnet_evaluate_snippet_callback(
) -> impl FnMut(&JSContextRef, JSValueRef, &[JSValueRef]) -> anyhow::Result<JSValue> {
    move |_ctx, _this, args| {
        // check the number of arguments
        if args.len() != 2 {
            eprintln!("Expected 2 arguments, got {}", args.len());
            return Err(anyhow::anyhow!("Expected 2 arguments, got {}", args.len()));
        }
        eprintln!("Evaluating jsonnet snippet");
        let var = args.get(0).unwrap().to_string();
        let code = args.get(1).unwrap().to_string();
        let var_len = var.len() as i32;
        let code_len = code.len() as i32;
        let var_ptr = var.as_ptr();
        let code_ptr = code.as_ptr();
        eprintln!("Calling jsonnet_evaluate");
        unsafe { jsonnet_evaluate(var_ptr, var_len, code_ptr, code_len) }
        let out_len = unsafe { jsonnet_output_len() };
        let mut out_buffer = Vec::with_capacity(out_len as usize);
        let out_ptr = out_buffer.as_mut_ptr();
        eprintln!("Getting jsonnet_output");
        let out_buffer = unsafe {
            jsonnet_output(out_ptr);
            Vec::from_raw_parts(out_ptr, out_len as usize, out_len as usize)
        };
        let jsonnet_output = String::from_utf8(out_buffer).unwrap();
        Ok(jsonnet_output.into())
    }
}
