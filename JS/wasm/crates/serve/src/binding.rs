use std::sync::{Arc, Mutex};

use jrsonnet_evaluator::{
    apply_tla,
    function::TlaArg,
    gc::GcHashMap,
    manifest::{JsonFormat, ManifestFormat},
    tb,
    trace::{CompactFormat, PathResolver, TraceFormat},
    FileImportResolver, State,
};
use jrsonnet_parser::IStr;
use wasi_common::WasiCtx;
use wasmtime::*;

pub struct VM {
    state: State,
    manifest_format: Box<dyn ManifestFormat>,
    trace_format: Box<dyn TraceFormat>,
    tla_args: GcHashMap<IStr, TlaArg>,
}
pub fn add_exports_to_linker(linker: &mut Linker<WasiCtx>) -> anyhow::Result<()> {
    let output: Arc<Mutex<String>> = Arc::new(Mutex::new(String::new()));
    let output_clone = output.clone();
    linker.func_wrap(
        "arakoo",
        "jsonnet_evaluate",
        move |mut caller: Caller<'_, WasiCtx>,
              var_ptr: i32,
              var_len: i32,
              path_ptr: i32,
              code_len: i32| {
            println!("Evaluating jsonnet snippet in cli");
            let output = output_clone.clone();
            let mem = match caller.get_export("memory") {
                Some(Extern::Memory(mem)) => mem,
                _ => return Err(Trap::NullReference.into()),
            };
            let var_offset = var_ptr as u32 as usize;
            let path_offset = path_ptr as u32 as usize;
            let mut var_buffer = vec![0; var_len as usize];
            let mut path_buffer = vec![0; code_len as usize];

            let path = match mem.read(&caller, path_offset, &mut path_buffer) {
                Ok(_) => match std::str::from_utf8(&path_buffer) {
                    Ok(s) => s,
                    Err(_) => return Err(Trap::BadSignature.into()),
                },
                _ => return Err(Trap::MemoryOutOfBounds.into()),
            };
            let _var = match mem.read(&caller, var_offset, &mut var_buffer) {
                Ok(_) => match std::str::from_utf8(&var_buffer) {
                    Ok(s) => s,
                    Err(_) => return Err(Trap::BadSignature.into()),
                },
                _ => return Err(Trap::MemoryOutOfBounds.into()),
            };

            let state = State::default();
            state.settings_mut().import_resolver = tb!(FileImportResolver::default());
            state.settings_mut().context_initializer =
                tb!(jrsonnet_stdlib::ContextInitializer::new(
                    state.clone(),
                    PathResolver::new_cwd_fallback(),
                ));
            let vm = VM {
                state,
                manifest_format: Box::new(JsonFormat::default()),
                trace_format: Box::new(CompactFormat::default()),
                tla_args: GcHashMap::default(),
            };
            let code = std::fs::read_to_string(path).unwrap();
            let out = match vm
                .state
                .evaluate_snippet("snippet", code)
                .and_then(|val| apply_tla(vm.state.clone(), &vm.tla_args, val))
                .and_then(|val| val.manifest(&vm.manifest_format))
            {
                Ok(v) => v,
                Err(e) => {
                    let mut out = String::new();
                    vm.trace_format.write_trace(&mut out, &e).unwrap();
                    out
                }
            };
            // let out_offset = out_ptr as u32 as usize;
            // match mem.write(&mut caller, out_offset, out.as_bytes()) {
            //     Ok(_) => {}
            //     _ => return Err(Trap::MemoryOutOfBounds.into()),
            // };
            let mut output = output.lock().unwrap();
            *output = out;
            Ok(())
        },
    )?;

    let output_clone = output.clone();
    linker.func_wrap("arakoo", "jsonnet_output_len", move || -> i32 {
        let output_clone = output_clone.clone();
        let output = output_clone.lock().unwrap();
        output.len() as i32
    })?;

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
            let out = output_clone.lock().unwrap();
            match mem.write(&mut caller, offset, out.as_bytes()) {
                Ok(_) => {}
                _ => return Err(Trap::MemoryOutOfBounds.into()),
            };
            Ok(())
        },
    )?;

    Ok(())
}
