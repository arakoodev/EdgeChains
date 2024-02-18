use std::sync::{Arc, Mutex};

use jrsonnet_evaluator::{
    apply_tla,
    function::TlaArg,
    gc::GcHashMap,
    manifest::{JsonFormat, ManifestFormat},
    tb,
    trace::{CompactFormat, PathResolver, TraceFormat},
    FileImportResolver, State, Val,
};
use jrsonnet_parser::IStr;
use tracing::error;
use wasi_common::WasiCtx;
use wasmtime::*;

pub struct VM {
    state: State,
    manifest_format: Box<dyn ManifestFormat>,
    trace_format: Box<dyn TraceFormat>,
    tla_args: GcHashMap<IStr, TlaArg>,
}
/// Adds exported functions to the Wasm linker.
///
/// This function wraps the `jsonnet_evaluate`, `jsonnet_output_len`, and `jsonnet_output`
/// functions to be called from WebAssembly. It sets up the necessary state and
/// memory management for evaluating Jsonnet code and writing the output back to
/// WebAssembly memory.
pub fn add_exports_to_linker(linker: &mut Linker<WasiCtx>) -> anyhow::Result<()> {
    // Create a shared output buffer that will be used to store the result of the Jsonnet evaluation.
    let output: Arc<Mutex<String>> = Arc::new(Mutex::new(String::new()));
    let output_clone = output.clone();

    // Wrap the `jsonnet_evaluate` function to be called from WebAssembly.
    linker.func_wrap(
        "arakoo",
        "jsonnet_evaluate",
        move |mut caller: Caller<'_, WasiCtx>,
              var_ptr: i32,
              var_len: i32,
              path_ptr: i32,
              code_len: i32| {
            // Clone the output buffer for use within the closure.
            let output = output_clone.clone();
            // Get the WebAssembly memory instance.
            let mem = match caller.get_export("memory") {
                Some(Extern::Memory(mem)) => mem,
                _ => return Err(Trap::NullReference.into()),
            };
            // Calculate the offsets for the variable and path buffers in WebAssembly memory.
            let var_offset = var_ptr as u32 as usize;
            let path_offset = path_ptr as u32 as usize;
            // Create buffers to read the variable and path data from WebAssembly memory.
            let mut var_buffer = vec![0; var_len as usize];
            let mut path_buffer = vec![0; code_len as usize];

            // Read the path data from WebAssembly memory and convert it to a string.
            let path = match mem.read(&caller, path_offset, &mut path_buffer) {
                Ok(_) => match std::str::from_utf8(&path_buffer) {
                    Ok(s) => s,
                    Err(_) => return Err(Trap::BadSignature.into()),
                },
                _ => return Err(Trap::MemoryOutOfBounds.into()),
            };
            // Read the variable data from WebAssembly memory and convert it to a string.
            let var = match mem.read(&caller, var_offset, &mut var_buffer) {
                Ok(_) => match std::str::from_utf8(&var_buffer) {
                    Ok(s) => s,
                    Err(_) => return Err(Trap::BadSignature.into()),
                },
                _ => return Err(Trap::MemoryOutOfBounds.into()),
            };
            // Parse the variable data as JSON.
            let var_json: serde_json::Value = match serde_json::from_str(var) {
                Ok(v) => v,
                Err(e) => {
                    error!("Error parsing var: {}", e);
                    return Err(Trap::BadSignature.into());
                }
            };

            // Initialize the Jsonnet VM state with default settings.
            let state = State::default();
            state.settings_mut().import_resolver = tb!(FileImportResolver::default());
            state.settings_mut().context_initializer =
                tb!(jrsonnet_stdlib::ContextInitializer::new(
                    state.clone(),
                    PathResolver::new_cwd_fallback(),
                ));
            // Create the Jsonnet VM with the default settings.
            let vm = VM {
                state,
                manifest_format: Box::new(JsonFormat::default()),
                trace_format: Box::new(CompactFormat::default()),
                tla_args: GcHashMap::default(),
            };

            // Evaluate the Jsonnet code snippet using the provided path and variables.
            let code = path;
            let any_initializer = vm.state.context_initializer();
            let context = any_initializer
                .as_any()
                .downcast_ref::<jrsonnet_stdlib::ContextInitializer>()
                .unwrap();
            for (key, value) in var_json.as_object().unwrap() {
                context.add_ext_var(key.into(), Val::Str(value.as_str().unwrap().into()));
            }
            let out = match vm
                .state
                .evaluate_snippet("snippet", code)
                .and_then(|val| apply_tla(vm.state.clone(), &vm.tla_args, val))
                .and_then(|val| val.manifest(&vm.manifest_format))
            {
                Ok(v) => v,
                Err(e) => {
                    error!("Error evaluating snippet: {}", e);
                    let mut out = String::new();
                    vm.trace_format.write_trace(&mut out, &e).unwrap();
                    out
                }
            };
            // Store the output of the Jsonnet evaluation in the shared output buffer.
            let mut output = output.lock().unwrap();
            *output = out;
            Ok(())
        },
    )?;

    // Wrap the `jsonnet_output_len` function to be called from WebAssembly.
    // This function returns the length of the output string.
    let output_clone = output.clone();
    linker.func_wrap("arakoo", "jsonnet_output_len", move || -> i32 {
        let output_clone = output_clone.clone();
        let output = output_clone.lock().unwrap().clone();
        output.len() as i32
    })?;

    // Wrap the `jsonnet_output` function to be called from WebAssembly.
    // This function writes the output string to the specified memory location.
    linker.func_wrap(
        "arakoo",
        "jsonnet_output",
        move |mut caller: Caller<'_, WasiCtx>, ptr: i32| {
            let output_clone = output.clone();
            let mem = match caller.get_export("memory") {
                Some(Extern::Memory(mem)) => mem,
                _ => return Err(Trap::NullReference.into()),
            };
            let offset = ptr as u32 as usize;
            let out = output_clone.lock().unwrap().clone();
            match mem.write(&mut caller, offset, out.as_bytes()) {
                Ok(_) => {}
                _ => return Err(Trap::MemoryOutOfBounds.into()),
            };
            Ok(())
        },
    )?;

    Ok(())
}
