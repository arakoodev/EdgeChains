use std::collections::HashMap;

use hyper::{header::HOST, http::request::Parts, HeaderMap, Uri};
use serde::{Deserialize, Serialize};

#[derive(Serialize,Deserialize,Debug,Clone)]
pub enum Method {
    GET,
    POST,
    PUT,
    DELETE,
    PATCH,
    HEAD,
    OPTIONS,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct WasmInput {
    pub uri: String,
    pub method: Method,
    pub headers: Vec<(String, String)>,
    pub body: Option<Vec<u8>>,
    pub params: Vec<(String, String)>,
}

#[derive(Deserialize, Debug, Clone, Serialize)]
pub struct WasmOutput {
    pub headers: HashMap<String, String>,
    pub status: u16,
    #[serde(rename = "statusText")]
    pub status_text: String,
    pub body: Option<String>,
}

impl WasmInput {
    pub fn new(request: &Parts, body: String) -> Self {
        let mut params: Vec<(String, String)> = vec![];

        if let Some(query) = request.uri.query() {
            for pair in query.split('&') {
                let mut parts = pair.split('=');
                let key = parts.next().unwrap();
                let value = parts.next().unwrap();
                params.push((key.to_string(), value.to_string()));
            }
        }

        let uri = Self::build_uri(request);

        Self {
            uri,
            method: Self::build_method(&request.method),
            headers: Self::build_headers(&request.headers),
            body: Self::build_body(body),
            params,
        }
    }


    fn build_uri(request: &Parts) -> String {
        Uri::builder()
            .scheme("http")
            .authority(request.headers.get(HOST).unwrap().to_str().unwrap())
            .path_and_query(request.uri.path_and_query().unwrap().clone())
            .build()
            .unwrap()
            .to_string()
    }

    fn build_headers(req_headers: &HeaderMap) -> Vec<(String, String)> {
        let mut headers: Vec<(String, String)> = vec![];

        for (key, value) in req_headers.iter() {
            headers.push((
                String::from(key.as_str()),
                String::from(value.to_str().unwrap().to_string()),
            ));
        }

        headers
    }

    fn build_method(method: &hyper::Method) -> Method {
        let method: Method = match method {
            &hyper::Method::GET => Method::GET,
            &hyper::Method::POST => Method::POST,
            &hyper::Method::PUT => Method::PUT,
            &hyper::Method::DELETE => Method::DELETE,
            &hyper::Method::PATCH => Method::PATCH,
            &hyper::Method::HEAD => Method::HEAD,
            &hyper::Method::OPTIONS => Method::OPTIONS,
            _ => Method::GET,
        };
        method
    }

    fn build_body(body:String) -> Option<Vec<u8>> {
        if body.is_empty() {
            None
        } else {
            Some(body.into_bytes())
        }
    }
}


impl WasmOutput {
    pub fn body(&self) -> String {
        self.body.clone().unwrap_or_default()
    }

    pub(crate) fn new() -> Self {
        Self {
            headers: HashMap::new(),
            status: 200,
            status_text: "OK".to_string(),
            body: Some(String::new()),
        }
    }

    pub async fn from_reqwest_response(response: reqwest::Response) -> anyhow::Result<Self> {
        let headers = response.headers().clone();
        let status = response.status().as_u16();
        let status_text = response.status().to_string();
        let body = response.text().await?;

        Ok(Self {
            headers: Self::build_headers_hash(&headers),
            status,
            status_text,
            body: Some(body),
        })
    }

    fn build_headers_hash(headers: &reqwest::header::HeaderMap) -> HashMap<String, String> {
        let mut parsed_headers = HashMap::new();

        for (key, value) in headers.iter() {
            parsed_headers.insert(
                key.as_str().to_string(),
                value.to_str().unwrap_or_default().to_string(),
            );
        }

        parsed_headers
    }
}
