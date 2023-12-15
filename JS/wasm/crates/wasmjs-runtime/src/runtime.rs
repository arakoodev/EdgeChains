use std::path::{Path, PathBuf};

use anyhow::Result;
use wasmtime_wasi::{ambient_authority, Dir, WasiCtxBuilder};

use crate::store::Store;

static JS_ENGINE_WASM: &[u8] = include_bytes!("../../wasmjs-engine/wasmjs-engine.wasm");

pub struct JavaScriptRuntime {
    path: PathBuf,
    store: Store,
}

impl JavaScriptRuntime {
    pub fn new(project_root: &Path, path: PathBuf) -> Result<Self> {
        let hash = Store::file_hash(&path)?;
        let store = Store::create(project_root, &["js", &hash])?;

        Ok(Self { path, store })
    }
}

impl Runtime for JavaScriptRuntime {
    fn prepare(&self) -> Result<()> {
        self.store.copy(&self.path, &["index.js"])?;

        Ok(())
    }

    fn prepare_wasi_ctx(&self, builder: &mut CtxBuilder) -> Result<()> {
        match builder {
            CtxBuilder::Preview1(ref mut builder) => {
                builder.preopened_dir(
                    Dir::open_ambient_dir(&self.store.folder, ambient_authority())?,
                    "/src",
                )?;
            }
        }

        Ok(())
    }

    fn module_bytes(&self) -> Result<Vec<u8>> {
        Ok(JS_ENGINE_WASM.to_vec())
    }
}

pub enum CtxBuilder {
    Preview1(WasiCtxBuilder),
}

pub trait Runtime {
    fn prepare(&self) -> Result<()> {
        Ok(())
    }

    fn prepare_wasi_ctx(&self, _builder: &mut CtxBuilder) -> Result<()> {
        Ok(())
    }

    fn module_bytes(&self) -> Result<Vec<u8>>;
}

pub fn init_runtime(project_root: &Path, path: &Path) -> Result<Box<dyn Runtime + Sync + Send>> {
    Ok(Box::new(JavaScriptRuntime::new(
        project_root,
        path.to_path_buf(),
    )?))
}
