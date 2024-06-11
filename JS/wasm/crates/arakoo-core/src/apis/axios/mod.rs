use std::thread;
use std::time::Duration;

use anyhow::{anyhow, Result};
use log::debug;
// use crate::{types::{HttpRequest, HttpResponse}, JSApiSet};
use super::{
    APIConfig, JSApiSet,
};
use javy::quickjs::{JSContextRef, JSValue, JSValueRef};
use quickjs_wasm_rs::{from_qjs_value, to_qjs_value};

pub(super) struct Axios;

impl JSApiSet for Axios {
    fn register(&self, runtime: &javy::Runtime, _config: &APIConfig) -> Result<()> {
        let context = runtime.context();
        let global = context.global_object()?;
        global
            .set_property(
                "setTimeout",
                context
                    .wrap_callback(set_timeout_api())
                    .expect("unable to get result"),
            )
            .expect("unable to set property");

        Ok(())
    }
}

fn set_timeout_api() -> impl FnMut(&JSContextRef, JSValueRef, &[JSValueRef]) -> Result<JSValue> {
    move |context: &JSContextRef, _this: JSValueRef, args: &[JSValueRef]| {
        let callback = args.get(0).unwrap();
        let default = to_qjs_value(context, &JSValue::Int(0)).unwrap();
        let timeout = args.get(1).unwrap_or(&default);
        thread::sleep(Duration::from_millis(
            timeout
                .as_f64()
                .expect("Unable to convert timeout to milliseconds") as u64,
        ));
        debug!("timeout reached");
        if callback.is_function() {
            let mut argsvec: Vec<JSValueRef> = vec![];
            if args.len() > 2 {
                for i in 2..args.len() {
                    argsvec.push(args.get(i).unwrap().to_owned())
                }
            }
            let res = callback.call(
                &to_qjs_value(context.to_owned(), &JSValue::Undefined).unwrap(),
                &argsvec,
            );
        }
        Ok(JSValue::Undefined)
    }
}