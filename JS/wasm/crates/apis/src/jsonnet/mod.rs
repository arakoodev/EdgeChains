use javy::quickjs::{JSContextRef, JSValue, JSValueRef};

use crate::{
    jsonnet_evaluate, jsonnet_evaluate_file, jsonnet_output, jsonnet_output_len, JSApiSet,
};

pub(super) struct Jsonnet;

impl JSApiSet for Jsonnet {
    fn register(&self, runtime: &javy::Runtime, _config: &crate::APIConfig) -> anyhow::Result<()> {
        let context = runtime.context();
        let global = context.global_object()?;
        global.set_property(
            "__jsonnet_evaluate_snippet",
            context.wrap_callback(jsonnet_evaluate_snippet_callback())?,
        )?;
        global.set_property(
            "__jsonnet_evaluate_file",
            context.wrap_callback(jsonnet_evaluate_file_callback())?,
        )?;

        Ok(())
    }
}

fn jsonnet_evaluate_file_callback(
) -> impl FnMut(&JSContextRef, JSValueRef, &[JSValueRef]) -> anyhow::Result<JSValue> {
    move |_ctx, _this, args| {
        // check the number of arguments
        if args.len() != 2 {
            return Err(anyhow::anyhow!("Expected 2 arguments, got {}", args.len()));
        }
        let var = args.get(0).unwrap().to_string();
        let path = args.get(1).unwrap().to_string();
        let var_len = var.len() as i32;
        let path_len = path.len() as i32;
        let var_ptr = var.as_ptr();
        let path_ptr = path.as_ptr();

        unsafe { jsonnet_evaluate_file(var_ptr, var_len, path_ptr, path_len) }
        let out_len = unsafe { jsonnet_output_len() };

        let mut out_buffer = Vec::with_capacity(out_len as usize);
        let out_ptr = out_buffer.as_mut_ptr();
        let out_buffer = unsafe {
            jsonnet_output(out_ptr);
            Vec::from_raw_parts(out_ptr, out_len as usize, out_len as usize)
        };
        // println!("out_buffer: {}", String::from_utf8(out_buffer.clone()).expect("unable to convert to string"));

        let jsonnet_output: serde_json::Value = match serde_json::from_slice(&out_buffer) {
            Ok(output) => output,
            Err(e) => {
                eprintln!("Failed to parse jsonnet output: {}", e);
                return Err(anyhow::anyhow!(
                    "Failed to parse jsonnet output: {}",
                    e.to_string()
                ));
            }
        };
        let jsonnet_output = jsonnet_output.to_string();
        Ok(jsonnet_output.into())
    }
}

fn jsonnet_evaluate_snippet_callback(
) -> impl FnMut(&JSContextRef, JSValueRef, &[JSValueRef]) -> anyhow::Result<JSValue> {
    move |_ctx, _this, args| {
        // check the number of arguments
        if args.len() != 2 {
            return Err(anyhow::anyhow!("Expected 2 arguments, got {}", args.len()));
        }
        let var = args.get(0).unwrap().to_string();
        let code = args.get(1).unwrap().to_string();
        let var_len = var.len() as i32;
        let path_len = code.len() as i32;
        let var_ptr = var.as_ptr();
        let path_ptr = code.as_ptr();

        unsafe { jsonnet_evaluate(var_ptr, var_len, path_ptr, path_len) }
        let out_len = unsafe { jsonnet_output_len() };

        let mut out_buffer = Vec::with_capacity(out_len as usize);
        let out_ptr = out_buffer.as_mut_ptr();
        let out_buffer = unsafe {
            jsonnet_output(out_ptr);
            Vec::from_raw_parts(out_ptr, out_len as usize, out_len as usize)
        };

        let jsonnet_output: serde_json::Value = match serde_json::from_slice(&out_buffer) {
            Ok(output) => output,
            Err(e) => {
                eprintln!("Failed to parse jsonnet output: {}", e);
                return Err(anyhow::anyhow!(
                    "Failed to parse jsonnet output: {}",
                    e.to_string()
                ));
            }
        };
        let jsonnet_output = jsonnet_output.to_string();
        Ok(jsonnet_output.into())
    }
}
