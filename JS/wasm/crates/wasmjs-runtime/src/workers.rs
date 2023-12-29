use crate::bindings::HttpBindings;
use crate::config::{ArakooConfig, Config};
use crate::io::{WasmInput, WasmOutput};
use crate::runtime::{init_runtime, CtxBuilder, Runtime};
use crate::bindings::http;
use std::{
    collections::HashMap,
    io::Cursor,
    path::{Path, PathBuf},
};

use actix_web::HttpRequest;
use sha256::digest as sha256_digest;
use wasmtime::{Config as WasmtimeConfig, Engine, Linker, Module, Store};
use wasmtime_wasi::{ambient_authority, Dir, WasiCtxBuilder};

use anyhow::Result;
use wasi_common::pipe::{ReadPipe, WritePipe};
use crate::ServeArgs;
use crate::geolocation::GeolocationData;

pub struct Stdio {
    pub stdin: Vec<u8>,
    pub stdout: WritePipe<Cursor<Vec<u8>>>,
}

impl Stdio {
    pub fn new(input: &str) -> Self {
        Self {
            stdin: Vec::from(input),
            stdout: WritePipe::new_in_memory(),
        }
    }

    pub fn configure_wasi_ctx(&self, mut builder: CtxBuilder) -> CtxBuilder {
        match builder {
            CtxBuilder::Preview1(ref mut wasi_builder) => {
                wasi_builder
                    .stdin(Box::new(ReadPipe::from(self.stdin.clone()).clone()))
                    .stdout(Box::new(self.stdout.clone()))
                    .inherit_stderr();
            }
        }
        builder
    }
}

pub struct Worker {
    pub id: String,
    engine: Engine,
    runtime: Box<dyn Runtime + Sync + Send>,
    module: Module,
    pub config: Config,
    path: PathBuf,
}

#[derive(Default)]
struct Host {
    pub wasi_preview1_ctx: Option<wasmtime_wasi::WasiCtx>,
    pub http: Option<HttpBindings>,
}

impl Worker {
    pub fn new(project_root: &Path, path: &Path, args: &ServeArgs) -> Result<Self> {
        let id = sha256_digest(project_root.join(path).to_string_lossy().as_bytes());

        let mut config=Config::default();
         match &args.config_path {
             Some(path) => config.features.geo = ArakooConfig::from_file(&path)?,
            _ => {},
        }
        config.vars = std::env::vars().collect();

        let engine = Engine::new(WasmtimeConfig::default().async_support(true))?;
        let runtime = init_runtime(project_root, path)?;
        let bytes = runtime.module_bytes()?;

        let module = if wasmparser::Parser::is_core_wasm(&bytes) {
            Ok(Module::from_binary(&engine, &bytes)?)
        } else {
            Err("Invalid module".to_string())
        }
        .map_err(|e| anyhow::anyhow!(e))?;

        runtime.prepare()?;

        Ok(Self {
            id,
            engine,
            runtime,
            module,
            config,
            path: path.to_path_buf(),
        })
    }

    pub fn prepare_wasi_context(
        &self,
        environment_variables: &[(String, String)],
        wasi_builder: &mut CtxBuilder,
    ) -> Result<()> {
        match wasi_builder {
            CtxBuilder::Preview1(wasi_builder) => {
                wasi_builder.envs(environment_variables)?;

                if let Some(folders) = self.config.folders.as_ref() {
                    for folder in folders {
                        if let Some(base) = &self.path.parent() {
                            let dir = Dir::open_ambient_dir(
                                base.join(&folder.from),
                                ambient_authority(),
                            )?;
                            wasi_builder.preopened_dir(dir, &folder.to)?;
                        } else {
                            panic!("Failed to initialize")
                        }
                    }
                }
            }
        }

        Ok(())
    }

    pub async fn run(
        &self,
        request: &HttpRequest,
        body: &str,
        vars: &HashMap<String, String>,
        geo_details: GeolocationData,
    ) -> Result<WasmOutput> {
        let input = serde_json::to_string(&WasmInput::new(request, body, geo_details)).unwrap();

        let mut linker = Linker::new(&self.engine);

        wasmtime_wasi::add_to_linker(&mut linker, |host: &mut Host| {
            host.wasi_preview1_ctx.as_mut().unwrap()
        })?;

        http::add_to_linker(&mut linker, |host: &mut Host| host.http.as_mut().unwrap())?;

        let environment_variables: Vec<(String, String)> =
            vars.iter().map(|(k, v)| (k.clone(), v.clone())).collect();

        let mut wasi_builder = CtxBuilder::Preview1(WasiCtxBuilder::new());

        self.prepare_wasi_context(&environment_variables, &mut wasi_builder)?;

        let stdio = Stdio::new(&input);
        let mut wasi_builder = stdio.configure_wasi_ctx(wasi_builder);

        self.runtime.prepare_wasi_ctx(&mut wasi_builder)?;

        let host = match wasi_builder {
            CtxBuilder::Preview1(mut wasi_builder) => Host {
                wasi_preview1_ctx: Some(wasi_builder.build()),
                http: Some(HttpBindings {
                    http_config: self.config.features.http_requests.clone(),
                }),
                ..Host::default()
            },
        };

        let contents = {
            let mut store = Store::new(&self.engine, host);
            linker.module_async(&mut store, "", &self.module).await?;

            linker
                .get_default(&mut store, "")?
                .typed::<(), ()>(&store)?
                .call_async(&mut store, ())
                .await?;

            drop(store);

            stdio
                .stdout
                .try_into_inner()
                .unwrap_or_default()
                .into_inner()
        };

        let output: WasmOutput = serde_json::from_slice(&contents)?;

        Ok(output)
    }
}
