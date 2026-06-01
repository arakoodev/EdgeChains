//! Native Rust router kernel for EdgeChains FFI acceleration.
//!
//! This module provides high-performance request routing via C FFI,
//! designed to be called from Python via ctypes bindings.
//!
//! # Safety
//! All C functions use proper pointer validation and memory management.
//! Callers must follow memory cleanup protocols (call free_string for returned pointers).

use std::ffi::{CStr, CString};
use std::os::raw::c_char;
use std::collections::HashMap;
use std::sync::OnceLock;

/// Global route registry initialized once at first use
static ROUTE_REGISTRY: OnceLock<HashMap<&'static str, &'static str>> = OnceLock::new();

/// Initialize the routing registry with static route mappings
fn init_registry() {
    ROUTE_REGISTRY.get_or_init(|| {
        let mut m = HashMap::new();
        m.insert("/v1/chat/completions", "primary_llm_cluster");
        m.insert("/v1/embeddings", "vector_processing_node");
        m.insert("/v1/models", "metadata_server");
        m
    });
}

/// Determines the optimal route destination for a given request path.
///
/// # Arguments
/// * `request_path_ptr` - Pointer to null-terminated UTF-8 encoded request path
///
/// # Returns
/// Pointer to null-terminated UTF-8 encoded destination cluster name.
/// **IMPORTANT**: Caller must free the returned pointer using `free_string()`
///
/// # Safety
/// - Returns "ERROR" if input pointer is null
/// - Returns "default" if route not found in registry
/// - All operations are bounds-checked
/// - Returned memory must be freed by caller
#[no_mangle]
pub extern "C" fn get_optimal_route(request_path_ptr: *const c_char) -> *mut c_char {
    init_registry();

    // Validate input pointer
    if request_path_ptr.is_null() {
        return CString::new("ERROR").unwrap().into_raw();
    }

    // Convert C string to Rust string, handling UTF-8 errors gracefully
    let path_str = match unsafe { CStr::from_ptr(request_path_ptr) }.to_str() {
        Ok(s) => s,
        Err(_) => return CString::new("ERROR").unwrap().into_raw(),
    };

    // Normalize path by removing leading slash for consistent lookup
    let normalized_path = path_str.trim_start_matches('/');

    // Look up route in registry, default to "default" if not found
    let dest = ROUTE_REGISTRY
        .get()
        .and_then(|reg| reg.get(normalized_path).copied())
        .unwrap_or("default");

    // Convert result to C string and return raw pointer
    CString::new(dest)
        .unwrap_or_else(|_| CString::new("default").unwrap())
        .into_raw()
}

/// Frees memory allocated by get_optimal_route.
///
/// # Arguments
/// * `s` - Pointer to C string allocated by get_optimal_route
///
/// # Safety
/// Must only be called with pointers returned from get_optimal_route.
/// Calling twice on the same pointer is undefined behavior.
#[no_mangle]
pub extern "C" fn free_string(s: *mut c_char) {
    if !s.is_null() {
        unsafe {
            let _ = CString::from_raw(s);
        }
    }
}
