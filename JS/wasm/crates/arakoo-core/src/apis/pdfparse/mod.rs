use super::{APIConfig, JSApiSet};
use anyhow::Result;
use javy::{
    quickjs::{from_qjs_value, to_qjs_value, JSContextRef, JSValue, JSValueRef},
    Runtime,
};

pub struct PDFPARSER;

impl JSApiSet for PDFPARSER {
    fn register(&self, runtime: &Runtime, _config: &APIConfig) -> Result<()> {
        let context = runtime.context();
        context
            .global_object()?
            .set_property("setImmediate", context.wrap_callback(set_immediate_api()).expect("unable to get result")).expect("unable to set property");
        Ok(())
    }
}

fn set_immediate_api(
) -> impl FnMut(&JSContextRef, JSValueRef, &[JSValueRef]) -> Result<JSValue> {
    move |context: &JSContextRef, _this: JSValueRef, args: &[JSValueRef]| {
        let callback = args.get(0).unwrap();
        if callback.is_function() {
            let mut argsvec: Vec<JSValueRef> = vec![];
            for n in 1..args.len() {
                argsvec.push(args.get(n).unwrap().to_owned())
            }
            let result = callback
                .call(
                    &to_qjs_value(context.to_owned(), &JSValue::Undefined).unwrap(),
                    args,
                )
                .expect("Failed to call callback");
            return Ok(from_qjs_value(result).expect("Unable to convert result into"));
        }
        Ok(JSValue::Undefined)
    }
}
        
