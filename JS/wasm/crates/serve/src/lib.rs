// mod binding;
mod binding;
mod io;

use std::{
    convert::Infallible,
    env,
    future::Future,
    net::SocketAddr,
    path::Path,
    pin::Pin,
    str::FromStr,
    sync::{Arc, Mutex},
    task::{self, Poll},
};

use binding::add_fetch_to_linker;
// use binding::add_exports_to_linker;
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

use wasmtime::{Caller, Config, Engine, Extern, Linker, Module, Store, Trap, WasmBacktraceDetails};

use crate::{
    binding::add_jsonnet_to_linker,
    io::{WasmInput, WasmOutput},
};

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
        let mut binding = Config::default();
        let config = binding.async_support(true);
        // check if env has debug flag
        if env::var("DEBUG").is_ok() {
            config
                .debug_info(true)
                .wasm_backtrace(true)
                .coredump_on_trap(true) // Enable core dumps on trap
                .wasm_backtrace_details(WasmBacktraceDetails::Enable);
        }

        let engine = Engine::new(&config)?;
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
                let mut response = Response::builder();
                response = response.status(output.status);

                let headers = output.headers.clone();
                let headers_vec: Vec<(String, String)> = headers
                    .into_iter()
                    .map(|(k, v)| (k.to_owned(), v.to_owned()))
                    .collect();
                headers_vec.iter().for_each(|(key, value)| {
                    response.headers_mut().unwrap().insert(
                        HeaderName::from_str(key).unwrap(),
                        HeaderValue::from_str(value).unwrap(),
                    );
                });

                let response = response.body(Body::from(output.body())).unwrap();
                Ok((response, None))
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

    /// Runs the WebAssembly module with the provided request parts and body.
    ///
    /// This function sets up the necessary state and memory management for running the WebAssembly
    /// module, including setting up the input and output buffers, and wrapping the necessary
    /// functions to be called from WebAssembly.
    async fn run(&self, parts: &Parts, body: &str) -> anyhow::Result<WasmOutput> {
        // Serialize the request parts and body into a JSON input for the WebAssembly module.
        let input = serde_json::to_vec(&WasmInput::new(parts, body)).unwrap();
        let mem_len = input.len() as i32;

        // Create a new linker with the WASI context.
        let mut linker: Linker<WasiCtx> = Linker::new(self.engine());
        wasmtime_wasi::add_to_linker(&mut linker, |ctx| ctx)?;

        // Wrap the `get_request_len` function to be called from WebAssembly.
        // This function returns the length of the input buffer.
        linker.func_wrap("arakoo", "get_request_len", move || -> i32 { mem_len })?;

        // Wrap the `get_request` function to be called from WebAssembly.
        // This function writes the input buffer to the specified memory location.
        match linker.func_wrap(
            "arakoo",
            "get_request",
            move |mut caller: Caller<'_, WasiCtx>, ptr: i32| {
                let mem = match caller.get_export("memory") {
                    Some(Extern::Memory(mem)) => mem,
                    _ => return Err(Trap::NullReference.into()),
                };
                let offset = ptr as u32 as usize;
                match mem.write(&mut caller, offset, &input) {
                    Ok(_) => {}
                    _ => return Err(Trap::MemoryOutOfBounds.into()),
                };
                Ok(())
            },
        ) {
            Ok(_) => {}
            Err(e) => {
                println!("Error adding get_request: {}", e);
            }
        }

        // Create a shared output buffer that will be used to store the result of the WebAssembly execution.
        let output: Arc<Mutex<WasmOutput>> = Arc::new(Mutex::new(WasmOutput::new()));
        let output_clone = output.clone();

        // Wrap the `set_output` function to be called from WebAssembly.
        // This function reads the output buffer from the specified memory location and updates the shared output buffer.
        linker.func_wrap(
            "arakoo",
            "set_output",
            move |mut caller: Caller<'_, WasiCtx>, ptr: i32, len: i32| {
                let output = output_clone.clone();
                let mem = match caller.get_export("memory") {
                    Some(Extern::Memory(mem)) => mem,
                    _ => return Err(Trap::NullReference.into()),
                };
                let offset = ptr as u32 as usize;
                let mut buffer = vec![0; len as usize];
                match mem.read(&caller, offset, &mut buffer) {
                    Ok(_) => match serde_json::from_slice::<WasmOutput>(&buffer) {
                        Ok(parsed_output) => {
                            let mut output = output.lock().unwrap();
                            *output = parsed_output;
                            Ok(())
                        }
                        Err(_e) => Err(Trap::BadSignature.into()),
                    },
                    _ => Err(Trap::MemoryOutOfBounds.into()),
                }
            },
        )?;

        // Add additional exports to the linker, such as Jsonnet evaluation functions.
        add_jsonnet_to_linker(&mut linker)?;
        add_fetch_to_linker(&mut linker)?;

        // Create a WASI context builder with inherited standard output and error streams.
        let wasi_builder = WasiCtxBuilder::new()
            .inherit_stdout()
            .inherit_stderr()
            .build();

        // Create a new store with the WASI context.
        let mut store = Store::new(self.engine(), wasi_builder);

        // Instantiate the WebAssembly module with the linker and store.
        linker.module(&mut store, "", self.module())?;

        // Get the entrypoint function from the WebAssembly instance and call it.
        let instance = linker
            .instantiate_async(&mut store, self.module())
            .await
            .map_err(anyhow::Error::msg)?;
        let run_entrypoint_fn = instance.get_typed_func::<(), ()>(&mut store, "run_entrypoint")?;
        run_entrypoint_fn
            .call_async(&mut store, ())
            .await
            .map_err(anyhow::Error::msg)?;

        // Drop the store to release resources.
        drop(store);

        // Lock the output buffer and return a clone of the result.
        let output = output.lock().unwrap().clone();
        Ok(output)
    }
    fn make_service(&self) -> RequestService {
        RequestService::new(self.clone())
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
        .with_ansi(true)
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
