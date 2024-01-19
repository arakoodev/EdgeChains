use std::{
    collections::HashMap,
    env, fs,
    io::{stdin, stdout, Read, Write},
};

use javy::{
    json,
    quickjs::{JSContextRef, JSValue, JSValueRef},
    Runtime,
};

wit_bindgen_rust::import!({paths: ["../../assets/wasmjs/wit/http.wit"]});
use crate::http::*;

pub enum RuntimeError {
    InvalidBinding { invalid_export: String },
}

pub fn load_bindings(context: &JSContextRef, global: JSValueRef) -> Result<(), RuntimeError> {
    global
        .set_property(
            "__send_http_request",
            context
                .wrap_callback(|_ctx, _this_arg, args| {
                    let uri = args[0].to_string();

                    let opts: HashMap<String, JSValue> = args[1].try_into()?;
                    let method = opts.get("method").unwrap().to_string();
                    let headers = opts.get("headers").unwrap();
                    let body = opts.get("body").unwrap();

                    let method = match method.as_str() {
                        "GET" => HttpMethod::Get,
                        "POST" => HttpMethod::Post,
                        _ => HttpMethod::Get,
                    };

                    let mut parsed_headers: Vec<(String, String)> = Vec::new();

                    if let JSValue::Object(headers) = headers {
                        for (key, val) in headers.iter() {
                            parsed_headers.push((key.to_string(), val.to_string()));
                        }
                    }

                    let headers_slice: &[(&str, &str)] = &parsed_headers
                        .iter()
                        .map(|(k, v)| (k.as_str(), v.as_str()))
                        .collect::<Vec<(&str, &str)>>();

                    let parsed_body: Option<&[u8]>;

                    if let JSValue::ArrayBuffer(buf) = body {
                        parsed_body = Some(buf.as_ref());
                    } else if let JSValue::String(data) = body {
                        parsed_body = Some(data.as_bytes());
                    } else {
                        parsed_body = None;
                    }

                    let req = HttpRequest {
                        uri: uri.as_str(),
                        body: parsed_body,
                        headers: headers_slice,
                        method,
                        params: &[],
                    };

                    match send_http_request(req) {
                        Ok(result) => {
                            let body = result.body.unwrap_or(Vec::new());
                            let mut headers = HashMap::new();

                            for (key, val) in result.headers.iter() {
                                headers.insert(key.as_str(), JSValue::String(val.to_string()));
                            }

                            let parsed_result = HashMap::from([
                                ("status", JSValue::Int(result.status as i32)),
                                ("body", JSValue::ArrayBuffer(body)),
                                ("headers", JSValue::from_hashmap(headers)),
                            ]);

                            Ok(JSValue::from_hashmap(parsed_result))
                        }
                        Err(err) => {
                            let kind = match err.error {
                                HttpError::InvalidRequest => "Invalid Request".to_string(),
                                HttpError::InvalidRequestBody => "Invalid Request Body".to_string(),
                                HttpError::InvalidResponseBody => {
                                    "Invalid Response Body".to_string()
                                }
                                HttpError::NotAllowed => "Not allowed".to_string(),
                                HttpError::InternalError => "Internal Error".to_string(),
                                HttpError::Timeout => "Request Timeout".to_string(),
                                HttpError::RedirectLoop => "Redirect Loop".to_string(),
                            };

                            Ok(JSValue::from_hashmap(HashMap::from([
                                ("error", JSValue::Bool(true)),
                                ("type", JSValue::String(kind)),
                                ("message", JSValue::String(err.message)),
                            ])))
                        }
                    }
                })
                .map_err(|_| RuntimeError::InvalidBinding {
                    invalid_export: "send_http_request".to_string(),
                })?,
        )
        .map_err(|_| RuntimeError::InvalidBinding {
            invalid_export: "send_http_request".to_string(),
        })?;

    global
        .set_property(
            "__console_log",
            context
                .wrap_callback(|_ctx, _this_arg, args| {
                    let msg = args[0].to_string();
                    eprintln!("{msg}");

                    Ok(JSValue::Null)
                })
                .map_err(|_| RuntimeError::InvalidBinding {
                    invalid_export: "console_log".to_string(),
                })?,
        )
        .map_err(|_| RuntimeError::InvalidBinding {
            invalid_export: "console_log".to_string(),
        })?;

    global
        .set_property(
            "readBytes",
            context
                .wrap_callback(|_ctx, _this_arg, args| {
                    let path = args[0].to_string();
                    match read_bytes(path.as_str()) {
                        Ok(result) => Ok(JSValue::String(result)),
                        Err(err) => {
                            let kind = match err {
                                FileError::NotFound => "File not found".to_string(),
                                FileError::InvalidPath => "Not allowed".to_string(),
                            };

                            Ok(JSValue::from_hashmap(HashMap::from([
                                ("error", JSValue::Bool(true)),
                                ("type", JSValue::String(kind)),
                            ])))
                        }
                    }
                })
                .map_err(|_| RuntimeError::InvalidBinding {
                    invalid_export: "readBytes".to_string(),
                })?,
        )
        .map_err(|_| RuntimeError::InvalidBinding {
            invalid_export: "readBytes".to_string(),
        })?;

    global
        .set_property(
            "jsonnet",
            context
                .wrap_callback(|_ctx, _this_arg, args| {
                    let path = args[0].to_string();
                    match jsonnet(path.as_str()) {
                        Ok(result) => Ok(JSValue::String(result)),
                        Err(err) => {
                            let kind = match err {
                                FileError::NotFound => "File not found".to_string(),
                                FileError::InvalidPath => "Not allowed".to_string(),
                            };

                            Ok(JSValue::from_hashmap(HashMap::from([
                                ("error", JSValue::Bool(true)),
                                ("type", JSValue::String(kind)),
                            ])))
                        }
                    }
                })
                .map_err(|_| RuntimeError::InvalidBinding {
                    invalid_export: "parseJsonnet".to_string(),
                })?,
        )
        .map_err(|_| RuntimeError::InvalidBinding {
            invalid_export: "parseJsonnet".to_string(),
        })?;

    global
        .set_property(
            "jsonnetExtVars",
            context
                .wrap_callback(|_ctx, _this_arg, args| {
                    let path = args[0].to_string();
                    let ext_var = args[1].to_string();
                    match jsonnet_ext_var(path.as_str(), ext_var.as_str()) {
                        Ok(result) => Ok(JSValue::String(result)),
                        Err(err) => {
                            let kind = match err {
                                FileError::NotFound => "File not found".to_string(),
                                FileError::InvalidPath => "Not allowed".to_string(),
                            };
                            Ok(JSValue::from_hashmap(HashMap::from([
                                ("error", JSValue::Bool(true)),
                                ("type", JSValue::String(kind)),
                            ])))
                        }
                    }
                })
                .map_err(|_| RuntimeError::InvalidBinding {
                    invalid_export: "parseJsonnet".to_string(),
                })?,
        )
        .map_err(|_| RuntimeError::InvalidBinding {
            invalid_export: "parseJsonnet".to_string(),
        })?;

    Ok(())
}

static POLYFILL: &str = include_str!("../shims/dist/index.js");
static POLYFILL_BUFFER: &str = include_str!("../shims/dist/buffer.js");
static POLYFILL_PATH: &str = include_str!("../shims/dist/path.js");
static POLYFILL_CRYPTO: &str = include_str!("../shims/dist/crypto.js");
static ARAKOOJSONNET: &str = include_str!("../shims/dist/arakoo-jsonnet.js");

fn main() {
    let runtime = Runtime::default();
    let context = runtime.context();

    let source = fs::read_to_string("/src/index.js");
    let mut contents = String::new();
    let mut buffer = String::new();
    let mut path = String::new();
    let mut crypto = String::new();

    let mut request = String::new();
    contents.push_str(POLYFILL);
    buffer.push_str(POLYFILL_BUFFER);
    path.push_str(POLYFILL_PATH);
    crypto.push_str(POLYFILL_CRYPTO);

    stdin().read_to_string(&mut request).unwrap();

    let mut env_vars = HashMap::new();
    for (key, val) in env::vars() {
        env_vars.insert(key, val);
    }
    let env_vars_json = serde_json::to_string(&env_vars).unwrap();
    contents.push_str(&format!("globalThis.env = {};", env_vars_json));

    contents.push_str(&source.unwrap());

    let global = context.global_object().unwrap();
    match load_bindings(context, global) {
        Ok(_) => {}
        Err(e) => match e {
            RuntimeError::InvalidBinding { invalid_export } => {
                eprintln!("There was an error adding the '{invalid_export}' binding");
            }
        },
    }

    context.eval_module("buffer", &buffer).unwrap();
    context.eval_module("crypto", &crypto).unwrap();
    context
        .eval_module("arakoo-jsonnet", &ARAKOOJSONNET)
        .unwrap();

    match context.eval_module("path", &path) {
        Ok(_) => {}
        Err(err) => eprintln!("Error loading the path shim: {err}"),
    };

    context.eval_module("handler.mjs", &contents).unwrap();

    context
        .eval_module(
            "runtime.mjs",
            &format!(
                r#"
                    import {{ default as handler }} from 'handler.mjs';
                    addEventListener('fetch', (e) => {{
                        e.respondWith(handler.fetch(e.request))
                    }});
                "#
            ),
        )
        .unwrap();

    let global = context.global_object().unwrap();
    let entrypoint = global.get_property("entrypoint").unwrap();

    let input_bytes = request.as_bytes();
    let input_value = json::transcode_input(context, input_bytes).unwrap();

    match entrypoint.call(&global, &[input_value]) {
        Ok(_) => {}
        Err(err) => eprintln!("Error calling the main entrypoint: {err}"),
    };

    if context.is_pending() {
        if let Err(err) = context.execute_pending() {
            eprintln!("Error running async methods: {err}");
        }
    }

    let global = context.global_object().unwrap();
    let error_value = global.get_property("error").unwrap();
    let output_value = global.get_property("result").unwrap();

    if !error_value.is_null_or_undefined() {
        eprintln!("{}", error_value.as_str_lossy());
    }

    let output = json::transcode_output(output_value).unwrap();

    stdout()
        .write_all(&output)
        .expect("Error when returning the response");
}
