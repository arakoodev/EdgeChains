use std::{
    collections::HashMap,
    ops::Deref,
    sync::{Arc, Mutex},
};

use crate::apis::{console, jsonnet};

use super::{wit::edgechains, APIConfig, JSApiSet};
use arakoo_jsonnet::{self};
use javy::quickjs::{JSContextRef, JSValue, JSValueRef};
use jrsonnet_evaluator::{
    function::builtin::{NativeCallback, NativeCallbackHandler},
    Error, Val,
};
use log::debug;
use quickjs_wasm_rs::{from_qjs_value, to_qjs_value};
// use jrsonnet_evaluator::function::

pub(super) struct Jsonnet;

impl JSApiSet for Jsonnet {
    fn register(&self, runtime: &javy::Runtime, _config: &APIConfig) -> anyhow::Result<()> {
        let context = runtime.context();
        let global = context.global_object()?;

        global.set_property(
            "__jsonnet_make",
            context.wrap_callback(jsonnet_make_closure())?,
        )?;
        global.set_property(
            "__jsonnet_ext_string",
            context.wrap_callback(jsonnet_ext_string_closure())?,
        )?;
        global.set_property(
            "__jsonnet_evaluate_snippet",
            context.wrap_callback(jsonnet_evaluate_snippet_closure())?,
        )?;
        global.set_property(
            "__jsonnet_evaluate_file",
            context.wrap_callback(jsonnet_evaluate_file_closure())?,
        )?;
        let jsonnet_func_map = JSValue::Object(HashMap::new());
        global.set_property(
            "__jsonnet_func_map",
            to_qjs_value(context, &jsonnet_func_map)?,
        )?;
        global.set_property(
            "__jsonnet_register_func",
            context.wrap_callback(jsonnet_register_func_closure())?,
        )?;
        global.set_property(
            "__jsonnet_destroy",
            context.wrap_callback(jsonnet_destroy_closure())?,
        )?;
        Ok(())
    }
}

#[derive(jrsonnet_gcmodule::Trace)]
pub struct NativeJSCallback(String);

impl NativeCallbackHandler for NativeJSCallback {
    fn call(
        &self,
        args: &[jrsonnet_evaluator::Val],
    ) -> jrsonnet_evaluator::Result<jrsonnet_evaluator::Val> {
        debug!("NativeJSCallback called: {:?}", self.0);
        let super_context = **super::CONTEXT.get().unwrap();
        let global = super_context
            .global_object()
            .expect("Unable to get super context");
        let func_map = global
            .get_property("__jsonnet_func_map")
            .expect("Unable to get global object");
        let func = func_map
            .get_property(self.0.clone())
            .expect("Unable to get property");
        // debug!(
        //     "func: {:?}",
        //     from_qjs_value(func).expect("Unable to convert map ref to map")
        // );
        let result;
        if args.len() > 0 {
            let args_str = serde_json::to_string(args).expect("Error converting args to JSON");
            let args_str = JSValue::String(args_str);
            debug!(
                "Calling function: {} with args = {}",
                self.0,
                args_str.to_string()
            );
            result = func
                .call(
                    &to_qjs_value(super_context, &JSValue::Undefined)
                        .expect("Unable to convert undefined"),
                    &[to_qjs_value(super_context, &args_str)
                        .expect("Unable to convert string to qjs value")],
                )
                .expect("Unable to call function");
            // let result = from_qjs_value(result).expect("Unable to convert qjs value to value");
            // debug!("Result of calling JS function: {}", result.as_str().unwrap());
        } else {
            let emtpy_str = JSValue::String("".to_string());
            let context = **super::CONTEXT.get().unwrap();
            result = func
                .call(
                    &to_qjs_value(context, &JSValue::Undefined)
                        .expect("Unable to convert undefined"),
                    &[to_qjs_value(context, &emtpy_str)
                        .expect("Unable to convert string to qjs value")],
                )
                .expect("Unable to call function");
            // let result = from_qjs_value(result).expect("Unable to convert qjs value to value");
        }
        if result.is_object() {
            debug!("Result is object");
            let constructor = result
                .get_property("constructor")
                .expect("Unable to get constructor");
            if !constructor.is_null_or_undefined() {
                let constructor_name = constructor
                    .get_property("name")
                    .expect("Unable to find name in constructor")
                    .to_string();
                if constructor_name == "Promise" {
                    let resolved_result: Arc<Mutex<Option<String>>> = Arc::new(Mutex::new(None));
                    let resolved_error: Arc<Mutex<Option<String>>> = Arc::new(Mutex::new(None));
                    let then_func = result
                        .get_property("then")
                        .expect("Unable to find then on promise");
                    if then_func.is_function() {
                        let resolved_result = resolved_result.clone();
                        let resolved_error = resolved_error.clone();
                        then_func
                            .call(
                                &result,
                                &[
                                    super_context
                                        .wrap_callback(move |context, _this, args| {
                                            resolved_result
                                                .lock()
                                                .unwrap()
                                                .replace(args.get(0).unwrap().to_string());
                                            Ok(JSValue::Undefined)
                                        })
                                        .expect("unable to wrap callback"),
                                    super_context
                                        .wrap_callback(move |context, _this, args| {
                                            // resolvedError.replace(Some(args.get(0).unwrap().to_string()));
                                            resolved_error
                                                .lock()
                                                .unwrap()
                                                .replace(args.get(0).unwrap().to_string());
                                            Ok(JSValue::Undefined)
                                        })
                                        .expect("Unable to wrap callback"),
                                ],
                            )
                            .expect("Unable to call then function");
                        super_context
                            .execute_pending()
                            .expect("Unable to execute pending tasks");
                    } else {
                        panic!("then is not a function");
                    }

                    let result = resolved_result.lock().unwrap();
                    let error = resolved_error.lock().unwrap();
                    if result.is_some() {
                        Ok(Val::Str(result.as_ref().unwrap().into()))
                    } else {
                        Ok(Val::Str(error.as_ref().unwrap().into()))
                    }
                } else {
                    Ok(Val::Str(
                        "Unable to find constructor property of returned type from function".into(),
                    ))
                }
            } else {
                Ok(Val::Str("Result is an object but retuned object does not contain constructor function".into()))
            }
        } else if result.is_str() {
            Ok(Val::Str(result.as_str().unwrap().into()))
        } else {
            // debug!("Result is unknown");
            Ok(Val::Str("Function does not return any result or promise".into()))
        }
    }
}

fn jsonnet_make_closure(
) -> impl FnMut(&JSContextRef, JSValueRef, &[JSValueRef]) -> anyhow::Result<JSValue> {
    move |_ctx, _this, args| {
        let ptr = arakoo_jsonnet::jsonnet_make();
        Ok(JSValue::from(ptr as u64 as f64))
    }
}

fn jsonnet_ext_string_closure(
) -> impl FnMut(&JSContextRef, JSValueRef, &[JSValueRef]) -> anyhow::Result<JSValue> {
    move |_ctx, _this, args| {
        // check the number of arguments
        if args.len() != 3 {
            return Err(anyhow::anyhow!(
                "Expected 2 arguments, got {}",
                args.len() - 1
            ));
        }
        let vm = args.get(0).unwrap().as_f64()?;
        let key = args.get(1).unwrap().to_string();
        let value = args.get(2).unwrap().to_string();
        // edgechains::jsonnet::jsonnet_ext_string(vm as u64, &key, &value);
        let ptr = vm as u64;
        arakoo_jsonnet::jsonnet_ext_string(ptr as *mut arakoo_jsonnet::VM, &key, &value);
        Ok(JSValue::Undefined)
    }
}

fn jsonnet_evaluate_snippet_closure(
) -> impl FnMut(&JSContextRef, JSValueRef, &[JSValueRef]) -> anyhow::Result<JSValue> {
    move |_ctx, _this, args| {
        // check the number of arguments
        if args.len() != 2 {
            return Err(anyhow::anyhow!("Expected 2 arguments, got {}", args.len()));
        }
        let vm = args.get(0).unwrap().as_f64()?;
        let code = args.get(1).unwrap().to_string();
        let code = code.as_str();
        // let out = edgechains::jsonnet::jsonnet_evaluate_snippet(vm as u64, "snippet", code);
        let out = arakoo_jsonnet::jsonnet_evaluate_snippet(
            vm as u64 as *mut arakoo_jsonnet::VM,
            "snippet",
            code,
        );
        debug!("Result of evaluating snippet: {}", out.to_string());
        Ok(out.into())
    }
}

fn jsonnet_evaluate_file_closure(
) -> impl FnMut(&JSContextRef, JSValueRef, &[JSValueRef]) -> anyhow::Result<JSValue> {
    move |_ctx, _this, args| {
        // check the number of arguments
        if args.len() != 2 {
            return Err(anyhow::anyhow!("Expected 2 arguments, got {}", args.len()));
        }
        let vm = args.get(0).unwrap().as_f64()?;
        let path = args.get(1).unwrap().to_string();
        let code = edgechains::utils::read_file(path.as_str());
        let out = arakoo_jsonnet::jsonnet_evaluate_snippet(
            vm as u64 as *mut arakoo_jsonnet::VM,
            "snippet",
            &code,
        );
        Ok(out.into())
    }
}

fn jsonnet_register_func_closure(
) -> impl FnMut(&JSContextRef, JSValueRef, &[JSValueRef]) -> anyhow::Result<JSValue> {
    move |_ctx, _this, args| {
        // check the number of arguments
        if args.len() != 3 {
            return Err(anyhow::anyhow!("Expected 3 arguments, got {}", args.len()));
        }
        let vm = args.get(0).unwrap().as_f64().unwrap();
        let func_name = args.get(1).unwrap().to_string();
        let args_num = args.get(2).unwrap().as_f64().unwrap();
        // edgechains::jsonnet::jsonnet_register_func(vm as u64, &func_name, args_num as u32);
        let vm = unsafe { &*(vm as u64 as *mut arakoo_jsonnet::VM) };
        let any_resolver = vm.state.context_initializer();
        let args_vec = vec![String::from("x"); args_num as usize];
        any_resolver
            .as_any()
            .downcast_ref::<arakoo_jsonnet::context::ArakooContextInitializer>()
            .expect("only arakoo context initializer supported")
            .add_native(
                func_name.clone(),
                NativeCallback::new(args_vec, NativeJSCallback(func_name.clone())),
            );
        debug!("Registered function: {}", func_name);
        Ok(JSValue::Undefined)
    }
}

fn jsonnet_destroy_closure(
) -> impl FnMut(&JSContextRef, JSValueRef, &[JSValueRef]) -> anyhow::Result<JSValue> {
    move |_ctx, _this, args| {
        // check the number of arguments
        if args.len() != 1 {
            return Err(anyhow::anyhow!("Expected 1 arguments, got {}", args.len()));
        }
        let vm = args.get(0).unwrap().as_f64()?;
        arakoo_jsonnet::jsonnet_destroy(vm as u64 as *mut arakoo_jsonnet::VM);
        Ok(JSValue::Undefined)
    }
}
