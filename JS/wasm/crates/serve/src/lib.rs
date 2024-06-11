// mod binding;
use wit::arakoo::edgechains::http as outbound_http;
use wit::arakoo::edgechains::http_types::HttpError;

mod binding;
mod io;

use std::{
    collections::HashMap,
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

use anyhow::Context;
// use binding::add_fetch_to_linker;
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
// use wasi_common::WasiCtx;
use wasmtime_wasi::{bindings, ResourceTable, WasiCtx, WasiCtxBuilder, WasiView};

use wasmtime::component::{Component, Linker};
use wasmtime::{Config, Engine, Store, WasmBacktraceDetails};
use wit::arakoo::edgechains::http_types;
use wit::arakoo::edgechains::utils;
use wit::exports::arakoo::edgechains::inbound_http::{self};

use crate::{
    // binding::add_jsonnet_to_linker,
    io::{WasmInput, WasmOutput},
};

mod wit {
    wasmtime::component::bindgen!({
        path:"../../wit",
        world:"reactor",
        async:true
    });
}

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
    component: Component,
}

struct Host {
    table: ResourceTable,
    wasi: WasiCtx,
    client: Option<reqwest::Client>,
}

impl WasiView for Host {
    fn table(&mut self) -> &mut ResourceTable {
        &mut self.table
    }

    fn ctx(&mut self) -> &mut wasmtime_wasi::WasiCtx {
        &mut self.wasi
    }
}

impl http_types::Host for Host {}

impl WorkerCtx {
    pub fn new(component_path: impl AsRef<Path>) -> anyhow::Result<Self> {
        tracing_subscriber();
        info!("Loading Component from {:?}", component_path.as_ref());
        let mut binding = Config::default();
        let config = binding.async_support(true).wasm_component_model(true);
        // check if env has debug flag
        if env::var("DEBUG").is_ok() {
            config
                .debug_info(true)
                .wasm_backtrace(true)
                .coredump_on_trap(true) // Enable core dumps on trap
                .wasm_backtrace_details(WasmBacktraceDetails::Enable);
        }

        let engine = Engine::new(&config)?;
        let component = Component::from_file(&engine, component_path)
            .with_context(|| format!("Failed to load component : invalid path"))?;

        Ok(Self { engine, component })
    }

    pub fn component(&self) -> &Component {
        &self.component
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
        let result = self.run(&parts, body_str).await;

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
                error!("Error: {:?}", e);
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
    async fn run(&self, parts: &Parts, body: String) -> anyhow::Result<WasmOutput> {
        // Serialize the request parts and body into a JSON input for the WebAssembly module.
        // let input = serde_json::to_vec(&WasmInput::new(parts, body)).unwrap();
        // let mem_len = input.len() as i32;

        // Create a new linker with the WASI context.
        let mut linker = Linker::new(self.engine());
        // wasmtime_wasi::add_to_linker(&mut linker, |ctx| ctx)?;
        bindings::cli::environment::add_to_linker(&mut linker, |x| x)
            .expect("Unable to add environment");
        bindings::cli::exit::add_to_linker(&mut linker, |x| x).expect("Unable to add cli");
        bindings::io::error::add_to_linker(&mut linker, |x| x).expect("Unable to add io error");
        // bindings::sync::io::streams::add_to_linker(&mut linker, |x| x)
        //     .expect("Unable to add io streams");
        bindings::io::poll::add_to_linker(&mut linker, |x| x).expect("unable to add io poll");
        bindings::io::streams::add_to_linker(&mut linker, |x| x).expect("Unable to add io streams");
        bindings::cli::stdin::add_to_linker(&mut linker, |x| x).expect("Unable to add cli stdin");
        bindings::cli::stdout::add_to_linker(&mut linker, |x| x).expect("Unable to add cli stdout");
        bindings::cli::stderr::add_to_linker(&mut linker, |x| x).expect("Unable to add cli stderr");
        bindings::cli::terminal_input::add_to_linker(&mut linker, |x| x)
            .expect("Unable to add cli terminal input");
        bindings::cli::terminal_output::add_to_linker(&mut linker, |x| x)
            .expect("Unable to add cli terminal output");
        bindings::cli::terminal_stdin::add_to_linker(&mut linker, |x| x)
            .expect("Unable to add cli terminal stdin");
        bindings::cli::terminal_stdout::add_to_linker(&mut linker, |x| x)
            .expect("Unable to add cli terminal stdout");
        bindings::cli::terminal_stderr::add_to_linker(&mut linker, |x| x)
            .expect("Unable to add cli terminal stderr");
        bindings::clocks::monotonic_clock::add_to_linker(&mut linker, |x| x)
            .expect("Unable to add clocks monotonic clock");
        bindings::clocks::wall_clock::add_to_linker(&mut linker, |x| x)
            .expect("Unable to add clocks wallclock");
        // bindings::sync::filesystem::types::add_to_linker(&mut linker, |x| x)
        //     .expect("Unable to add filesystem types");
        bindings::filesystem::types::add_to_linker(&mut linker, |x| x)
            .expect("Unable to add filesystem types");
        bindings::filesystem::preopens::add_to_linker(&mut linker, |x| x)
            .expect("Unable to add filesystem preopens");
        bindings::random::random::add_to_linker(&mut linker, |x| x).expect("Unable to add random");

        // Wrap the `get_request_len` function to be called from WebAssembly.
        // This function returns the length of the input buffer.
        // linker.func_wrap("arakoo", "get_request_len", move || -> i32 { mem_len })?;

        // Wrap the `get_request` function to be called from WebAssembly.
        // This function writes the input buffer to the specified memory location.
        // match linker.func_wrap(
        //     "arakoo",
        //     "get_request",
        //     move |mut caller: Caller<'_, WasiCtx>, ptr: i32| {
        //         let mem = match caller.get_export("memory") {
        //             Some(Extern::Memory(mem)) => mem,
        //             _ => return Err(Trap::NullReference.into()),
        //         };
        //         let offset = ptr as u32 as usize;
        //         match mem.write(&mut caller, offset, &input) {
        //             Ok(_) => {}
        //             _ => return Err(Trap::MemoryOutOfBounds.into()),
        //         };
        //         Ok(())
        //     },
        // ) {
        //     Ok(_) => {}
        //     Err(e) => {
        //         println!("Error adding get_request: {}", e);
        //     }
        // }

        // Create a shared output buffer that will be used to store the result of the WebAssembly execution.
        // let output: Arc<Mutex<WasmOutput>> = Arc::new(Mutex::new(WasmOutput::new()));
        // let output_clone = output.clone();

        // Wrap the `set_output` function to be called from WebAssembly.
        // This function reads the output buffer from the specified memory location and updates the shared output buffer.
        // linker.func_wrap(
        //     "arakoo",
        //     "set_output",
        //     move |mut caller: Caller<'_, WasiCtx>, ptr: i32, len: i32| {
        //         let output = output_clone.clone();
        //         let mem = match caller.get_export("memory") {
        //             Some(Extern::Memory(mem)) => mem,
        //             _ => return Err(Trap::NullReference.into()),
        //         };
        //         let offset = ptr as u32 as usize;
        //         let mut buffer = vec![0; len as usize];
        //         match mem.read(&caller, offset, &mut buffer) {
        //             Ok(_) => match serde_json::from_slice::<WasmOutput>(&buffer) {
        //                 Ok(parsed_output) => {
        //                     let mut output = output.lock().unwrap();
        //                     *output = parsed_output;
        //                     Ok(())
        //                 }
        //                 Err(_e) => Err(Trap::BadSignature.into()),
        //             },
        //             _ => Err(Trap::MemoryOutOfBounds.into()),
        //         }
        //     },
        // )?;

        // Add additional exports to the linker, such as Jsonnet evaluation functions.
        // add_jsonnet_to_linker(&mut linker)?;
        // add_fetch_to_linker(&mut linker)?;

        // Create a WASI context builder with inherited standard output and error streams.
        let wasi = WasiCtxBuilder::new()
            .inherit_stdout()
            .inherit_stderr()
            .build();

        let table: ResourceTable = ResourceTable::new();

        // Create a new store with the WASI context.
        let mut store = Store::new(
            self.engine(),
            Host {
                table,
                wasi,
                client: None,
            },
        );

        // Instantiate the WebAssembly module with the linker and store.
        // linker.module(&mut store, "", self.module())?;

        // Get the entrypoint function from the WebAssembly instance and call it.
        // let instance = linker
        //     .instantiate_async(&mut store, self.module())
        //     .await
        //     .map_err(anyhow::Error::msg)?;
        // let run_entrypoint_fn = instance.get_typed_func::<(), ()>(&mut store, "run_entrypoint")?;
        // run_entrypoint_fn
        //     .call_async(&mut store, ())
        //     .await
        //     .map_err(anyhow::Error::msg)?;
        let wasm_input = WasmInput::new(parts, body);
        let request = inbound_http::Request {
            method: match wasm_input.method {
                io::Method::GET => http_types::Method::Get,
                io::Method::POST => http_types::Method::Post,
                io::Method::PUT => http_types::Method::Put,
                io::Method::DELETE => http_types::Method::Delete,
                io::Method::PATCH => http_types::Method::Patch,
                io::Method::HEAD => http_types::Method::Head,
                io::Method::OPTIONS => http_types::Method::Options,
            },
            uri: wasm_input.uri,
            headers: wasm_input.headers,
            params: wasm_input.params,
            body: wasm_input.body,
        };
        wit::Reactor::add_to_linker(&mut linker, |x| x)?;
        let (reactor, instance) =
            wit::Reactor::instantiate_async(&mut store, self.component(), &linker).await?;
        let guest = reactor.arakoo_edgechains_inbound_http();
        let result: Result<http_types::Response, anyhow::Error> =
            guest.call_handle_request(&mut store, &request).await;
        let mut wasm_output = WasmOutput::new();
        // println!("Result of guest calling: {:?}", &result);
        match result {
            Ok(res) => {
                wasm_output.status = res.status;
                wasm_output.status_text = res.status_text;
                let mut headers_map = HashMap::new();
                for (key, val) in res.headers.unwrap().iter() {
                    headers_map.insert(key.to_owned(), val.to_owned());
                }
                wasm_output.headers = headers_map;
                let body_vec = res.body.unwrap();
                if body_vec.len() > 0 {
                    wasm_output.body = Some(String::from_utf8(body_vec).unwrap());
                }
            }
            Err(err) => println!("Error occured : {:?}", err),
        };

        // Drop the store to release resources.
        drop(store);
        Ok(wasm_output)
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
