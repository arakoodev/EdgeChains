use anyhow::Result;
use javy::{quickjs::JSValue, Runtime};

use crate::{APIConfig, JSApiSet};

pub struct PrismaClient;

impl JSApiSet for PrismaClient {
    fn register(&self, runtime: &Runtime, _config: &APIConfig) -> Result<()> {
        let ctx = runtime.context();
        ctx.eval_global("prisma.js", include_str!("js/dist/index.js")).unwrap();
        Ok(())
    }
}
