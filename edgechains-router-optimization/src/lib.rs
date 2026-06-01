use std::ffi::{CStr, CString};
use std::os::raw::c_char;
use std::collections::HashMap;
use std::sync::OnceLock;

static ROUTE_REGISTRY: OnceLock<HashMap<&'static str, &'static str>> = OnceLock::new();

fn init_registry() {
    ROUTE_REGISTRY.get_or_init(|| {
        let mut m = HashMap::new();
        m.insert("v1/chat/completions", "primary_llm_cluster");
        m.insert("v1/embeddings", "vector_processing_node");
        m.insert("v1/models", "metadata_server");
        m
    });
}

#[no_mangle]
pub extern "C" fn get_optimal_route(request_path_ptr: *const c_char) -> *mut c_char {
    init_registry();
    if request_path_ptr.is_null() { return CString::new("ERROR").unwrap().into_raw(); }
    let path_str = unsafe { CStr::from_ptr(request_path_ptr) }.to_str().unwrap_or("");
    let dest = *ROUTE_REGISTRY.get().unwrap().get(path_str).unwrap_or(&"default");
    CString::new(dest).unwrap().into_raw()
}

#[no_mangle]
pub extern "C" fn free_string(s: *mut c_char) {
    if !s.is_null() { unsafe { let _ = CString::from_raw(s); } }
}