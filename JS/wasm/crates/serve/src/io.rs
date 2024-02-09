use std::collections::HashMap;

use hyper::{header::HOST, http::request::Parts, HeaderMap, Uri};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug)]
pub struct WasmInput<'a> {
    url: String,
    method: &'a str,
    headers: HashMap<String, String>,
    body: &'a str,
    params: HashMap<String, String>,
}

#[derive(Deserialize, Debug)]
pub struct WasmOutput {
    pub headers: HashMap<String, String>,
    pub status: u16,
    #[serde(rename = "statusText")]
    pub status_text: String,
    body: String,
}

impl<'a> WasmInput<'a> {
    pub fn new(request: &'a Parts, body: &'a str) -> Self {
        let mut params = HashMap::new();

        if let Some(query) = request.uri.query() {
            for pair in query.split('&') {
                let mut parts = pair.split('=');
                let key = parts.next().unwrap();
                let value = parts.next().unwrap();
                params.insert(key.to_string(), value.to_string());
            }
        }

        let url = Self::build_url(request);

        Self {
            url,
            method: request.method.as_str(),
            headers: Self::build_headers_hash(&request.headers),
            body,
            params,
        }
    }

    fn build_url(request: &Parts) -> String {
        Uri::builder()
            .scheme("http")
            .authority(request.headers.get(HOST).unwrap().to_str().unwrap())
            .path_and_query(request.uri.path_and_query().unwrap().clone())
            .build()
            .unwrap()
            .to_string()
    }

    fn build_headers_hash(headers: &HeaderMap) -> HashMap<String, String> {
        let mut parsed_headers = HashMap::new();

        for (key, value) in headers.iter() {
            parsed_headers.insert(
                String::from(key.as_str()),
                String::from(value.to_str().unwrap()),
            );
        }

        parsed_headers
    }
}
impl WasmOutput {
    pub fn body(&self) -> String {
        self.body.clone()
    }
}
