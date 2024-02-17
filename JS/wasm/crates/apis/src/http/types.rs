use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Serialize, Deserialize, Debug)]
pub struct Request {
    url: String,
    method: String,
    headers: HashMap<String, String>,
    body: String,
    params: HashMap<String, String>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct Response {
    pub headers: HashMap<String, String>,
    pub status: u16,
    #[serde(rename = "statusText")]
    pub status_text: String,
    pub body: String,
}
