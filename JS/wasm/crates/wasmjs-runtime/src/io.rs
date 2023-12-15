use actix_web::{
    http::{header::HeaderMap, StatusCode, Uri},
    HttpRequest,
};
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, fmt::Debug};
use serde_json::{Map, Value as SerdeValue};
use crate::geolocation::GeolocationData;

#[derive(Serialize, Deserialize, Debug)]
pub struct WasmInput<'a> {
    url: String,
    method: &'a str,
    headers: HashMap<String, String>,
    body: &'a str,
    params: HashMap<String, String>,
    geo: Map<String, SerdeValue>
}

impl<'a> WasmInput<'a> {
    pub fn new(request: &'a HttpRequest, body: &'a str, geo_details: GeolocationData) -> Self {
        let mut params = HashMap::new();

        for (k, v) in request.match_info().iter() {
            params.insert(k.to_string(), v.to_string());
        }

        let url = Self::build_url(request);

        Self {
            url,
            method: request.method().as_str(),
            headers: Self::build_headers_hash(request.headers()),
            body,
            params,
            geo: geo_details.data.clone()
        }
    }

    fn build_url(request: &HttpRequest) -> String {
        match Uri::builder()
            .scheme(request.connection_info().scheme())
            .authority(request.connection_info().host())
            .path_and_query(request.uri().to_string())
            .build()
        {
            Ok(uri) => uri.to_string(),
            Err(_) => request.uri().to_string(),
        }
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

#[derive(Deserialize, Debug)]
pub struct WasmOutput {
    pub headers: HashMap<String, String>,
    pub status: u16,
    data: String,
}

impl WasmOutput {
    pub fn new(body: &str, headers: HashMap<String, String>, status: u16) -> Self {
        Self {
            data: String::from(body),
            headers,
            status,
        }
    }

    pub fn failed(err: anyhow::Error, worker_name: Option<String>, route: Option<String>) -> Self {
        eprintln!(
            "Error running {:?} at route {:?}: {:?}",
            worker_name, route, err
        );
        Self::new(
            "err",
            HashMap::from([("content-type".to_string(), "text/html".to_string())]),
            StatusCode::INTERNAL_SERVER_ERROR.as_u16(),
        )
    }

    pub fn body(&self) -> anyhow::Result<Vec<u8>> {
        Ok(self.data.as_bytes().into())
    }
}
