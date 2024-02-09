mod io;
use std::{
    convert::Infallible,
    env,
    future::Future,
    net::SocketAddr,
    path::Path,
    pin::Pin,
    task::{self, Poll},
};

use futures::future::{self, Ready};
use hyper::{
    header::{HeaderName, HeaderValue},
    http::request::Parts,
    server::conn::AddrStream,
    service::Service,
    Body, Request, Response,
};

use tracing::{error, event, info, Level};
use tracing_subscriber::{filter::EnvFilter, FmtSubscriber};
use wasi_common::WasiCtx;
use wasmtime_wasi::WasiCtxBuilder;

use wasmtime::{Config, Engine, Instance, Linker, Memory, Module, Store};

use crate::io::{WasmInput, WasmOutput};

#[derive(Clone)]
pub struct RequestService {
    worker_ctx: WorkerCtx,
}

impl RequestService {
    /// Create a new request service.
    fn new(ctx: WorkerCtx) -> Self {
        Self { worker_ctx: ctx }
    }
}

#[derive(Clone)]
pub struct WorkerCtx {
    engine: Engine,
    module: Module,
}

impl WorkerCtx {
    pub fn new(module_path: impl AsRef<Path>) -> anyhow::Result<Self> {
        tracing_subscriber();
        info!("Loading module from {:?}", module_path.as_ref());
        // let config = configure_wasmtime(profiling_strategy);
        let engine = Engine::new(Config::default().async_support(true)).unwrap(); //Engine::new(&config)?;

        let module = Module::from_file(&engine, module_path)?;
        Ok(Self { engine, module })
    }

    pub fn module(&self) -> &Module {
        &self.module
    }

    pub fn engine(&self) -> &Engine {
        &self.engine
    }
    pub async fn serve(self, addr: SocketAddr) -> Result<(), hyper::Error> {
        info!("Starting server ...");
        let server = hyper::Server::bind(&addr).serve(self);
        event!(Level::INFO, "Listening on http://{}", server.local_addr());
        server.await?;
        Ok(())
    }

    pub async fn handle_request(
        &self,
        request: hyper::Request<hyper::Body>,
    ) -> anyhow::Result<(Response<Body>, Option<anyhow::Error>)> {
        let (parts, body) = request.into_parts();
        info!("Handling request: {:?} {:?}", parts.method, parts.uri);
        let body = hyper::body::to_bytes(body).await.unwrap();
        let body_str = String::from_utf8_lossy(&body).to_string();
        let result = self.run(&parts, &body_str).await;
        match result {
            Ok(output) => {
                let parsed_output = serde_json::from_slice::<WasmOutput>(&output);
                match parsed_output {
                    Ok(parsed_output) => {
                        let mut response = Response::builder();
                        response = response
                            .status(parsed_output.status);

                        let headers = parsed_output.headers.clone();
                        let headers_vec: Vec<(String, String)> = headers
                            .into_iter()
                            .map(|(k, v)| (k.to_owned(), v.to_owned()))
                            .collect();
                        headers_vec.iter().for_each(|(key, value)| {
                            response.headers_mut().unwrap().insert(
                                HeaderName::from_bytes(key.as_bytes()).unwrap(),
                                HeaderValue::from_str(value).unwrap(),
                            );
                        });
                        let response = Response::new(Body::from(parsed_output.body()));
                        Ok((response, None))
                    }
                    Err(e) => {
                        error!("Error: {}", e);
                        let response = Response::builder()
                            .status(500)
                            .body(Body::from("Internal Server Error"))
                            .unwrap();
                        Ok((response, Some(e.into())))
                    }
                }
            }
            Err(e) => {
                error!("Error: {}", e);
                let response = Response::builder()
                    .status(500)
                    .body(Body::from("Internal Server Error"))
                    .unwrap();
                Ok((response, Some(e)))
            }
        }
    }

    fn make_service(&self) -> RequestService {
        RequestService::new(self.clone())
    }

    async fn run(&self, parts: &Parts, body: &str) -> anyhow::Result<Vec<u8>> {
        let input = serde_json::to_string(&WasmInput::new(parts, body)).unwrap();

        let mut linker: Linker<WasiCtx> = Linker::new(self.engine());

        wasmtime_wasi::add_to_linker(&mut linker, |ctx| ctx)?;

        let mut wasi_ctx = WasiCtxBuilder::new();
        wasi_ctx.inherit_stdout().inherit_stderr();
        let wasi_builder = wasi_ctx.build();
        let mut store = Store::new(self.engine(), wasi_builder);

        let instance = linker
            .instantiate_async(&mut store, self.module())
            .await
            .map_err(anyhow::Error::msg)?;

        let memory = &instance.get_memory(&mut store, "memory").unwrap();

        let (result_ptr, result_len) =
            copy_request_into_instance(input.as_bytes(), &mut store, &instance, memory).await?;

        let run_entrypoint_fn =
            instance.get_typed_func::<(u32, u32), u32>(&mut store, "run_entrypoint")?;

        let output_ptr = run_entrypoint_fn
            .call_async(&mut store, (result_ptr, result_len))
            .await
            .map_err(anyhow::Error::msg)?;

        let output = copy_bytecode_from_instance(output_ptr, &mut store, memory)?;

        drop(store);

        Ok(output)
    }
}

impl<'addr> Service<&'addr AddrStream> for WorkerCtx {
    type Response = RequestService;
    type Error = Infallible;
    type Future = Ready<Result<Self::Response, Self::Error>>;

    fn poll_ready(&mut self, _cx: &mut task::Context<'_>) -> Poll<Result<(), Self::Error>> {
        Poll::Ready(Ok(()))
    }

    fn call(&mut self, _addr: &'addr AddrStream) -> Self::Future {
        future::ok(self.make_service())
    }
}

impl Service<Request<hyper::Body>> for RequestService {
    type Response = Response<Body>;
    type Error = anyhow::Error;
    #[allow(clippy::type_complexity)]
    type Future = Pin<Box<dyn Future<Output = Result<Self::Response, Self::Error>> + Send>>;

    fn poll_ready(&mut self, _cx: &mut task::Context<'_>) -> Poll<Result<(), Self::Error>> {
        Poll::Ready(Ok(()))
    }

    fn call(&mut self, req: Request<hyper::Body>) -> Self::Future {
        let ctx = self.worker_ctx.clone();

        Box::pin(async move { ctx.handle_request(req).await.map(|result| result.0) })
    }
}

fn tracing_subscriber() {
    let verbosity = match env::var("RUST_LOG_VERBOSITY") {
        Ok(s) => s.parse().unwrap_or(0),
        Err(_) => 0,
    };

    if env::var("RUST_LOG").ok().is_none() {
        match verbosity {
            0 => env::set_var("RUST_LOG", "info"),
            1 => env::set_var("RUST_LOG", "debug"),
            _ => env::set_var("RUST_LOG", "trace"),
        }
    }

    // Build a subscriber, using the default `RUST_LOG` environment variable for our filter.
    let builder = FmtSubscriber::builder()
        .with_writer(std::io::stderr)
        .with_env_filter(EnvFilter::from_default_env())
        .with_target(false);

    match env::var("RUST_LOG_PRETTY") {
        // If the `RUST_LOG_PRETTY` environment variable is set to "true", we should emit logs in a
        // pretty, human-readable output format.
        Ok(s) if s == "true" => builder
            .pretty()
            // Show levels, because ANSI escape sequences are normally used to indicate this.
            .with_level(true)
            .init(),
        // Otherwise, we should install the subscriber without any further additions.
        _ => builder.with_ansi(false).init(),
    }
    event!(
        Level::DEBUG,
        "RUST_LOG set to '{}'",
        env::var("RUST_LOG").unwrap_or_else(|_| String::from("<Could not get env>"))
    );
}

async fn copy_request_into_instance(
    request: &[u8],
    mut store: &mut Store<WasiCtx>,
    instance: &Instance,
    memory: &Memory,
) -> anyhow::Result<(u32, u32)> {
    let realloc_fn = instance
        .get_typed_func::<(u32, u32, u32, u32), u32>(&mut store, "canonical_abi_realloc")?;
    let request_len = request.len().try_into()?;

    let original_ptr = 0;
    let original_size = 0;
    let alignment = 1;
    let size = request_len;
    let request_ptr = realloc_fn
        .call_async(&mut store, (original_ptr, original_size, alignment, size))
        .await?;

    memory.write(&mut store, request_ptr.try_into()?, request)?;

    Ok((request_ptr, request_len))
}

fn copy_bytecode_from_instance(
    ret_ptr: u32,
    mut store: &mut Store<WasiCtx>,
    memory: &Memory,
) -> anyhow::Result<Vec<u8>> {
    let mut ret_buffer = [0; 8];
    memory.read(&mut store, ret_ptr.try_into()?, &mut ret_buffer)?;

    let bytecode_ptr = u32::from_le_bytes(ret_buffer[0..4].try_into()?);
    let bytecode_len = u32::from_le_bytes(ret_buffer[4..8].try_into()?);

    let mut bytecode = vec![0; bytecode_len.try_into()?];
    memory.read(&mut store, bytecode_ptr.try_into()?, &mut bytecode)?;

    Ok(bytecode)
}
