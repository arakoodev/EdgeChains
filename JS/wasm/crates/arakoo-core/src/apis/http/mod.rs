use anyhow::Result;
use super::JSApiSet;

// use crate::{fetch, get_response, get_response_len, http::types::Request, JSApiSet};


pub(super) struct Http;

impl JSApiSet for Http {
    fn register(&self, runtime: &javy::Runtime, _config: &super::APIConfig) -> Result<()> {
        let context = runtime.context();
        context.eval_global("http.js", include_str!("shims/dist/index.js"))?;
        Ok(())
    }
}
