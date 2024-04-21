use std::{
    env,
    sync::{Arc, Mutex},
};

use arakoo_jsonnet::{
    ext_string, jsonnet_destroy, jsonnet_evaluate_file, jsonnet_evaluate_snippet, jsonnet_make,
};

use std::{fs, io};
use tokio::runtime::Builder;
use tracing::error;
use wasi_common::WasiCtx;
use wasmtime::*;

use crate::io::{WasmInput, WasmOutput};

// pub struct VM {
//     state: State,
//     manifest_format: Box<dyn ManifestFormat>,
//     trace_format: Box<dyn TraceFormat>,
//     tla_args: GcHashMap<IStr, TlaArg>,
// }

/// Adds exported functions to the Wasm linker.
///
/// This function wraps the `jsonnet_evaluate`, `jsonnet_output_len`, and `jsonnet_output`
/// functions to be called from WebAssembly. It sets up the necessary state and
/// memory management for evaluating Jsonnet code and writing the output back to
/// WebAssembly memory.
pub fn add_jsonnet_to_linker(linker: &mut Linker<WasiCtx>) -> anyhow::Result<()> {
    // Create a shared output buffer that will be used to store the result of the Jsonnet evaluation.
    let output: Arc<Mutex<String>> = Arc::new(Mutex::new(String::new()));
    let mut output_clone = output.clone();

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
            let vm = jsonnet_make();

            // Evaluate the Jsonnet code snippet using the provided path and variables.
            let code = path;
            for (key, value) in var_json.as_object().unwrap() {
                // context.add_ext_var(key.into(), Val::Str(value.as_str().unwrap().into()));
                ext_string(
                    vm,
                    key,
                    value.as_str().expect("ext_string value is not a string"),
                );
            }
            let out = jsonnet_evaluate_snippet(vm, "deleteme", code);
            // Store the output of the Jsonnet evaluation in the shared output buffer.
            let mut output = output.lock().unwrap();
            *output = out;
            jsonnet_destroy(vm);
            Ok(())
        },
    )?;

    output_clone = output.clone();
    // Wrap the `jsonnet_evaluate_file` function to be called from WebAssembly.
    linker.func_wrap(
        "arakoo",
        "jsonnet_evaluate_file",
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
            // println!("var_json: {:?}", var_json);

            let vm = jsonnet_make();

            for (key, value) in var_json.as_object().unwrap() {
                ext_string(
                    vm,
                    key,
                    value.as_str().expect("ext_string value is not a string"),
                );
            }
            let code = fs::read_to_string(path).expect("File not found");
            let out = jsonnet_evaluate_snippet(vm, "deleteme", &code);
            let mut output: std::sync::MutexGuard<'_, String> = output.lock().unwrap();
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

pub fn add_fetch_to_linker(linker: &mut Linker<WasiCtx>) -> anyhow::Result<()> {
    let response: Arc<Mutex<String>> = Arc::new(Mutex::new(String::new()));
    let error: Arc<Mutex<String>> = Arc::new(Mutex::new(String::new()));

    let response_clone = response.clone();
    let error_clone = error.clone();
    linker.func_wrap(
        "arakoo",
        "fetch",
        move |mut caller: Caller<'_, WasiCtx>, request_ptr: i32, request_len: i32| {
            let response_arc = response_clone.clone();
            let error = error_clone.clone();
            let mem = match caller.get_export("memory") {
                Some(Extern::Memory(mem)) => mem,
                _ => {
                    let mut error = error.lock().unwrap();
                    *error = "Memory not found".to_string();
                    return Err(Trap::NullReference.into());
                }
            };
            let request_offset = request_ptr as u32 as usize;
            let mut request_buffer = vec![0; request_len as usize];
            let request = match mem.read(&caller, request_offset, &mut request_buffer) {
                Ok(_) => match std::str::from_utf8(&request_buffer) {
                    Ok(s) => s.to_string(), // Clone the string here
                    Err(_) => {
                        let mut error = error.lock().unwrap();
                        *error = "Bad signature".to_string();
                        return Err(Trap::BadSignature.into());
                    }
                },
                _ => {
                    let mut error = error.lock().unwrap();
                    *error = "Memory out of bounds".to_string();
                    return Err(Trap::MemoryOutOfBounds.into());
                }
            };

            let thread_result = std::thread::spawn(move || {
                Builder::new_current_thread()
                    .enable_all()
                    .build()
                    .unwrap()
                    .block_on(async {
                        let request: WasmInput = match serde_json::from_str(&request) {
                            Ok(r) => r,
                            Err(e) => {
                                return Err(anyhow::anyhow!("Error parsing request: {}", e));
                            }
                        };
                        let method: reqwest::Method = match request.method().parse() {
                            Ok(m) => m,
                            Err(_) => {
                                return Err(anyhow::anyhow!(
                                    "Invalid method: {}",
                                    request.method()
                                ));
                            }
                        };
                        let client = reqwest::Client::new();
                        let mut builder = client.request(method, request.url());
                        let header = request.headers();
                        for (k, v) in header {
                            builder = builder.header(k, v);
                        }
                        builder = builder.body(request.body().to_string());
                        match builder.send().await {
                            Ok(r) => {
                                let response = WasmOutput::from_reqwest_response(r).await?;
                                Ok(response)
                            }
                            Err(e) => {
                                error!("Error sending request: {}", e);
                                return Err(anyhow::anyhow!("Error sending request: {}", e));
                            }
                        }
                    })
            })
            .join();
            let response = match thread_result {
                Ok(Ok(r)) => r,
                Ok(Err(e)) => {
                    let mut error = error.lock().unwrap();
                    *error = format!("Error sending request: {}", e);
                    error!("Error sending request: {}", e);
                    return Err(Trap::BadSignature.into());
                }
                Err(_) => {
                    let mut error = error.lock().unwrap();
                    *error = "Error sending request: thread join error".to_string();
                    error!("Error sending request: thread join error");
                    return Err(Trap::BadSignature.into());
                }
            };

            let res = serde_json::to_string(&response).unwrap();
            let mut response = response_arc.lock().unwrap();
            *response = res;
            Ok(())
        },
    )?;
    // add the fetch_output_len and fetch_output functions here
    let response_clone = response.clone();
    linker.func_wrap("arakoo", "get_response_len", move || -> i32 {
        let response_clone = response_clone.clone();
        let response = response_clone.lock().unwrap().clone();
        response.len() as i32
    })?;

    // also add the fetch_error_len and fetch_error functions here
    linker.func_wrap(
        "arakoo",
        "get_response",
        move |mut _caller: Caller<'_, WasiCtx>, ptr: i32| {
            let response_clone = response.clone();
            let mem = match _caller.get_export("memory") {
                Some(Extern::Memory(mem)) => mem,
                _ => return Err(Trap::NullReference.into()),
            };
            let offset = ptr as u32 as usize;
            let response = response_clone.lock().unwrap().clone();
            match mem.write(&mut _caller, offset, response.as_bytes()) {
                Ok(_) => {}
                _ => return Err(Trap::MemoryOutOfBounds.into()),
            };
            Ok(())
        },
    )?;
    Ok(())
}
