use actix_web::http::Uri;
use jsonnet::JsonnetVm;
use reqwest::Method;
use serde::Deserialize;
use tokio::runtime::Builder;
use wiggle::GuestErrorType;
use crate::error::Error;

wit_bindgen_wasmtime::export!({paths: ["../../assets/wasmjs/wit/http.wit",],
    async:[]
    }
);

wiggle::from_witx!({
    witx:["$CARGO_MANIFEST_DIR/../../assets/wasmjs/wit/arakoo-geo.witx"],
    errors: { arakoo_status => Error },
});

impl  GuestErrorType for ArakooStatus {
    fn success() -> Self {
        ArakooStatus::Ok
    }
}

use self::{http::{Http, HttpRequest, HttpRequestError, HttpResponse, HttpError, HttpMethod, FileError}, types::ArakooStatus};

#[derive(Deserialize, Clone)]
#[serde(default)]
pub struct HttpRequestsConfig {
    pub allowed_hosts: Vec<String>,
    pub allowed_methods: Vec<String>,
    pub allow_http: bool,
}

impl Default for HttpRequestsConfig {
    fn default() -> Self {
        Self {
            allowed_hosts: vec!["aws.connect.psdb.cloud".to_string()],
            allowed_methods: Vec::from([
                String::from("GET"),
                String::from("POST"),
                String::from("PUT"),
                String::from("PATCH"),
                String::from("DELETE"),
            ]),
            allow_http: false,
        }
    }
}

pub struct HttpBindings {
    pub http_config: HttpRequestsConfig,
}

impl From<HttpMethod> for Method {
    fn from(value: HttpMethod) -> Self {
        match value {
            HttpMethod::Get => Method::GET,
            HttpMethod::Post => Method::POST,
            HttpMethod::Put => Method::PUT,
            HttpMethod::Patch => Method::PATCH,
            HttpMethod::Delete => Method::DELETE,
            HttpMethod::Options => Method::OPTIONS,
            HttpMethod::Head => Method::HEAD,
        }
    }
}

impl From<reqwest::Error> for HttpError {
    fn from(value: reqwest::Error) -> Self {
        if value.is_timeout() {
            HttpError::Timeout
        } else if value.is_redirect() {
            HttpError::RedirectLoop
        } else if value.is_request() {
            HttpError::InvalidRequest
        } else if value.is_body() {
            HttpError::InvalidRequestBody
        } else if value.is_decode() {
            HttpError::InvalidResponseBody
        } else {
            HttpError::InternalError
        }
    }
}

impl Http for HttpBindings {
    fn send_http_request(
        &mut self,
        req: HttpRequest<'_>,
    ) -> Result<HttpResponse, HttpRequestError> {
        let mut headers = Vec::new();
        let url = req.uri.to_string();
        let body = req.body.unwrap_or(&[]).to_vec();
        let uri = url.parse::<Uri>().map_err(|e| HttpRequestError {
            error: HttpError::InvalidRequest,
            message: e.to_string(),
        })?;
        let method: Method = req.method.into();

        if uri.host().is_some()
            && !self
                .http_config
                .allowed_hosts
                .contains(&uri.host().unwrap().to_string())
        {
            return Err(HttpRequestError {
                error: HttpError::NotAllowed,
                message: format!("'{}' is not in the allowed hosts list", uri.host().unwrap()),
            });
        }

        if uri.scheme().is_some()
            && (!self.http_config.allow_http && uri.scheme_str().unwrap() == "http")
        {
            return Err(HttpRequestError {
                error: HttpError::NotAllowed,
                message: "Only https is allowed".to_string(),
            });
        }

        if !self
            .http_config
            .allowed_methods
            .contains(&method.to_string())
        {
            return Err(HttpRequestError {
                error: HttpError::NotAllowed,
                message: format!("'{}' method not allowed", method.as_str()),
            });
        }

        for (key, value) in req.headers {
            headers.push((key.to_string(), value.to_string()));
        }

        let thread_result = std::thread::spawn(move || {
            Builder::new_current_thread()
                .enable_all()
                .build()
                .unwrap()
                .block_on(async {
                    let client = reqwest::Client::new();

                    let mut builder = client.request(method, url);

                    for (key, value) in headers {
                        builder = builder.header(key, value);
                    }

                    builder = builder.body(body);

                    match builder.send().await {
                        Ok(res) => {
                            let mut headers = Vec::new();
                            let status = res.status().as_u16();

                            for (name, value) in res.headers().iter() {
                                headers
                                    .push((name.to_string(), value.to_str().unwrap().to_string()));
                            }

                            let body = res.bytes().await;

                            Ok(HttpResponse {
                                headers,
                                status,
                                body: Some(body.unwrap().to_vec()),
                            })
                        }
                        Err(e) => {
                            let message = e.to_string();

                            Err(HttpRequestError {
                                error: e.into(),
                                message,
                            })
                        }
                    }
                })
        })
        .join();

        match thread_result {
            Ok(res) => match res {
                Ok(res) => Ok(res),
                Err(err) => Err(err),
            },
            Err(_) => Err(HttpRequestError {
                error: HttpError::InternalError,
                message: "Could not process the request".to_string(),
            }),
        }
    }

    fn read_bytes(&mut self, path: &str) -> Result<String, FileError> {
        //     read the file from the path and return the bytes
        //     if the file does not exist, return FileError::NotFound
        let path = path.to_owned();
        let thread_result = std::thread::spawn(move || {
            Builder::new_current_thread()
                .enable_all()
                .build()
                .unwrap()
                .block_on(async {
                    let bytes = tokio::fs::read(path).await;
                    match bytes {
                        Ok(bytes) =>
                            Ok(std::str::from_utf8(&bytes).unwrap().to_string()),
                        Err(_) => {
                            Err(FileError::NotFound)
                        }
                    }
                })
        })
            .join();

        match thread_result {
            Ok(res) => match res {
                Ok(res) => Ok(res),
                Err(err) => Err(err),
            },
            Err(_) => Err(FileError::NotFound),
        }
    }


    fn parse_jsonnet(&mut self, file: &str) -> Result<String, FileError> {
        parse_jsonnet(file)
    }
}


pub fn parse_jsonnet(file: &str) -> Result<String, FileError> {
    let file = file.to_owned();
    let thread_result = std::thread::spawn(move || {
        Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap()
            .block_on(async {
                let mut vm = JsonnetVm::new();
                let json = vm.evaluate_file(&file);

                match json {
                    Ok(json) => Ok(json.to_string()),
                    Err(e) => {
                        println!("Error: {}", e);
                        Err(FileError::NotFound)
                    },
                }
            })
    })
        .join();

    match thread_result {
        Ok(res) => match res {
            Ok(res) => Ok(res),
            Err(err) => Err(err),
        },
        Err(_) => Err(FileError::NotFound),
    }
}
