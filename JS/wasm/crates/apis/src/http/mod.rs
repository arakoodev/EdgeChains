pub mod types;

use anyhow::Result;

use crate::JSApiSet;

pub(super) struct Http;

impl JSApiSet for Http {
    fn register(&self, runtime: &javy::Runtime, _config: &crate::APIConfig) -> Result<()> {
        let context = runtime.context();
        context.eval_global("http.js", include_str!("shims/dist/index.js"))?;
        let global = context.global_object()?;
        global.set_property("arakoo", context.value_from_bool(true)?)?;
        Ok(())
    }
}
