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
use wasm_bindgen::prelude::*;

pub struct VM {
    state: State,
    manifest_format: Box<dyn ManifestFormat>,
    trace_format: Box<dyn TraceFormat>,
    tla_args: GcHashMap<IStr, TlaArg>,
}

#[wasm_bindgen]
pub fn jsonnet_make() -> *mut VM {
    let state = State::default();
    state.settings_mut().import_resolver = tb!(FileImportResolver::default());
    state.settings_mut().context_initializer = tb!(jrsonnet_stdlib::ContextInitializer::new(
        state.clone(),
        PathResolver::new_cwd_fallback(),
    ));
    Box::into_raw(Box::new(VM {
        state,
        manifest_format: Box::new(JsonFormat::default()),
        trace_format: Box::new(CompactFormat::default()),
        tla_args: GcHashMap::default(),
    }))
}

#[wasm_bindgen]
pub fn jsonnet_destroy(vm: *mut VM) {
    unsafe {
        let dloc_vm = Box::from_raw(vm);
        drop(dloc_vm);
    }
}

#[wasm_bindgen]
pub fn jsonnet_evaluate_snippet(vm: *mut VM, filename: &str, snippet: &str) -> String {
    let vm = unsafe { &mut *vm };
    match vm
        .state
        .evaluate_snippet(filename, snippet)
        .and_then(|val| apply_tla(vm.state.clone(), &vm.tla_args, val))
        .and_then(|val| val.manifest(&vm.manifest_format))
    {
        Ok(v) => v,
        Err(e) => {
            let mut out = String::new();
            vm.trace_format.write_trace(&mut out, &e).unwrap();
            out
        }
    }
}

#[wasm_bindgen]
pub fn ext_string(vm: *mut VM, key: &str, value: &str) -> *mut VM {
    let vm = unsafe { &mut *vm };
    {
        let any_initializer = vm.state.context_initializer();
        any_initializer
            .as_any()
            .downcast_ref::<jrsonnet_stdlib::ContextInitializer>()
            .unwrap()
            .add_ext_var(key.into(), Val::Str(value.into()));
    }
    vm
}
