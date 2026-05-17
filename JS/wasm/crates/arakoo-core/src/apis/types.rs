use std::collections::HashMap;

use serde::{Deserialize, Serialize};
use serde_bytes::ByteBuf;

#[derive(Serialize, Deserialize, Debug)]
pub struct HttpRequest {
    pub method: String,
    pub uri: String,
    #[serde(default)]
    pub headers: HashMap<String, String>,
    pub params: HashMap<String, String>,
    pub body: Option<ByteBuf>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct HttpResponse {
    pub status: u16,
    #[serde(default)]
    pub headers: HashMap<String, String>,
    pub body: Option<ByteBuf>,
    pub status_text: String,

}

pub mod arakoo_http {
    use anyhow::Result;

    /// The Arakoo HTTP request.
    pub type Request = http::Request<Option<bytes::Bytes>>;

    /// The Arakoo HTTP response.
    pub type Response = http::Response<Option<bytes::Bytes>>;

    /// Helper function to return a 404 Not Found response.
    pub fn not_found() -> Result<Response> {
        Ok(http::Response::builder()
            .status(404)
            .body(Some("Not Found".into()))?)
    }

    /// Helper function to return a 500 Internal Server Error response.
    pub fn internal_server_error() -> Result<Response> {
        Ok(http::Response::builder()
            .status(500)
            .body(Some("Internal Server Error".into()))?)
    }
}