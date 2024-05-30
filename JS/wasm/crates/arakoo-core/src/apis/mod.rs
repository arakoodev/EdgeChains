//! JS APIs for Javy.
//!
//! This crate provides JS APIs you can add to Javy.
//!
//! Example usage:
//! ```
//! # use anyhow::{anyhow, Error, Result};
//! use javy::{quickjs::JSValue, Runtime};
//! use javy_apis::RuntimeExt;
//!
//! let runtime = Runtime::new_with_defaults()?;
//! let context = runtime.context();
//! context.global_object()?.set_property(
//!    "print",
//!    context.wrap_callback(move |_ctx, _this, args| {
//!        let str = args
//!            .first()
//!            .ok_or(anyhow!("Need to pass an argument"))?
//!            .to_string();
//!        println!("{str}");
//!        Ok(JSValue::Undefined)
//!    })?,
//! )?;
//! context.eval_global("hello.js", "print('hello!');")?;
//! # Ok::<(), Error>(())
//! ```
//!
//! If you want to customize the runtime or the APIs, you can use the
//! [`Runtime::new_with_apis`] method instead to provide a [`javy::Config`]
//! for the underlying [`Runtime`] or an [`APIConfig`] for the APIs.
//!
//! ## Features
//! * `console` - Registers an implementation of the `console` API.
//! * `text_encoding` - Registers implementations of `TextEncoder` and `TextDecoder`.
//! * `random` - Overrides the implementation of `Math.random` to one that
//!   seeds the RNG on first call to `Math.random`. This is helpful to enable
//!   when using Wizer to snapshot a [`javy::Runtime`] so that the output of
//!   `Math.random` relies on the WASI context used at runtime and not the
//!   WASI context used when Wizening. Enabling this feature will increase the
//!   size of the Wasm module that includes the Javy Runtime and will
//!   introduce an additional hostcall invocation when `Math.random` is
//!   invoked for the first time.
//! * `stream_io` - Registers implementations of `Javy.IO.readSync` and `Javy.IO.writeSync`.

use anyhow::Result;
use javy::Runtime;
use super::wit;

pub use api_config::APIConfig;
pub use console::LogStream;
pub use runtime_ext::RuntimeExt;

use super::CONTEXT;

pub mod http;
pub mod types;

mod api_config;
mod console;
mod random;
mod runtime_ext;
mod stream_io;
mod text_encoding;
mod pdfparse;
mod fetch;
mod jsonnet;
pub(crate) trait JSApiSet {
    fn register(&self, runtime: &Runtime, config: &APIConfig) -> Result<()>;
}

/// Adds enabled JS APIs to the provided [`Runtime`].
///
/// ## Example
/// ```
/// # use anyhow::Error;
/// # use javy::Runtime;
/// # use javy_apis::APIConfig;
/// let runtime = Runtime::default();
/// javy_apis::add_to_runtime(&runtime, APIConfig::default())?;
/// # Ok::<(), Error>(())
/// ```
pub fn add_to_runtime(runtime: &Runtime, config: APIConfig) -> Result<()> {
    console::Console::new().register(runtime, &config)?;
    random::Random.register(runtime, &config)?;
    stream_io::StreamIO.register(runtime, &config)?;
    text_encoding::TextEncoding.register(runtime, &config)?;
    http::Http.register(runtime, &config)?;
    jsonnet::Jsonnet.register(runtime, &config)?;
    pdfparse::PDFPARSER.register(runtime, &config)?;
    fetch::Fetch.register(runtime, &config)?;
    Ok(())
}
