use std::collections::HashMap;

use hyper::{header::HOST, http::request::Parts, HeaderMap, Uri};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug)]
pub struct WasmInput<'a> {
    url: String,
    method: &'a str,
    headers: HashMap<String, String>,
    body: String,
    params: HashMap<String, String>,
}

#[derive(Deserialize, Debug, Clone, Serialize)]
pub struct WasmOutput {
    pub headers: HashMap<String, String>,
    pub status: u16,
    #[serde(rename = "statusText")]
    pub status_text: String,
    body: Option<String>,
}

impl<'a> WasmInput<'a> {
    pub fn new(request: &'a Parts, body: String) -> Self {
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

    pub fn url(&self) -> &str {
        &self.url
    }

    pub fn method(&self) -> &str {
        self.method
    }

    pub fn headers(&self) -> &HashMap<String, String> {
        &self.headers
    }

    pub fn body(&self) -> &str {
        &self.body
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
