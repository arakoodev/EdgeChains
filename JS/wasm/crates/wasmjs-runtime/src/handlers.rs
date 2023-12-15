use crate::{io::WasmOutput, routes::WORKERS, server::AppData};
use actix_files::NamedFile;
use actix_web::{
    http::StatusCode,
    web::{Bytes, Data},
    HttpRequest, HttpResponse,
};
use std::{
    io::{Error, ErrorKind},
    path::{Component, Path, PathBuf},
};
use std::net::{IpAddr, Ipv4Addr};
use std::str::FromStr;
use crate::geolocation::GeolocationData;

fn clean_up_path(uri: &str) -> PathBuf {
    let path = PathBuf::from_iter(uri.split('/'));

    let valid_components: Vec<Component<'_>> = path
        .components()
        .filter(|c| matches!(c, Component::Normal(_)))
        .collect();

    PathBuf::from_iter(valid_components)
}

fn retrieve_asset_path(root_path: &Path, file_path: &Path, index_folder: bool) -> Option<PathBuf> {
    let public_folder = root_path.join("public");
    let asset_path = if index_folder {
        public_folder.join(file_path).join("index.html")
    } else {
        public_folder.join(file_path)
    };

    if asset_path.starts_with(public_folder) && asset_path.exists() && asset_path.is_file() {
        Some(asset_path)
    } else {
        None
    }
}

pub async fn handle_assets(req: &HttpRequest) -> Result<NamedFile, Error> {
    let root_path = &req
        .app_data::<Data<AppData>>()
        .expect("error fetching app data")
        .root_path;
    let uri_path = req.path();

    let parsed_path = clean_up_path(uri_path);

    if let Some(file_path) = retrieve_asset_path(root_path, &parsed_path, false) {
        NamedFile::open_async(file_path).await
    } else if let Some(index_folder_path) = retrieve_asset_path(root_path, &parsed_path, true) {
        NamedFile::open_async(index_folder_path).await
    } else {
        Err(Error::new(ErrorKind::NotFound, "The file is not present"))
    }
}

pub async fn handle_not_found(req: &HttpRequest) -> HttpResponse {
    let root_path = &req
        .app_data::<Data<AppData>>()
        .expect("error fetching app data")
        .root_path;
    let public_404_path = root_path.join("public").join("404.html");

    if let Ok(file) = NamedFile::open_async(public_404_path).await {
        file.into_response(req)
    } else {
        HttpResponse::NotFound().body("")
    }
}

const CORS_HEADER: &str = "Access-Control-Allow-Origin";

pub async fn handle_worker(req: HttpRequest, body: Bytes) -> HttpResponse {
    let app_data = req
        .app_data::<Data<AppData>>()
        .expect("error fetching app data");

    let selected_route = app_data.routes.retrieve_best_route(req.path());
    let worker = if let Some(route) = selected_route {
        if route.is_dynamic() {
            if let Ok(existing_file) = handle_assets(&req).await {
                return existing_file.into_response(&req);
            }
        }

        let workers = WORKERS
            .read()
            .expect("error locking worker lock for reading");

        Some(
            workers
                .get(&route.worker)
                .expect("unexpected missing worker")
                .clone(),
        )
    } else {
        None
    };

    if worker.is_none() {
        return handle_not_found(&req).await;
    };
    let worker = worker.unwrap();

    let body_str = String::from_utf8(body.to_vec()).unwrap_or_else(|_| String::from(""));

    let vars = &worker.config.vars;
    let geolocation = worker.config.features.geo.geolocation();

    let client = req.connection_info();
    let ip = client.realip_remote_addr();

    let loop_back_ip = IpAddr::V4(Ipv4Addr::new(127,0,0,1));

    let look_up_ip = match ip {
        None => {  loop_back_ip }
        Some(result) => {match  IpAddr::from_str(result) {
            Ok(ip_addr) => {ip_addr}
            Err(_) => {loop_back_ip}
        }}
    };

    let geo_details = match geolocation.lookup(&look_up_ip) {
        None => { GeolocationData::default() }
        Some(details) => {details}
    };

    let handler_result = match worker.run(&req, &body_str, vars, geo_details).await {
        Ok(output) => output,
        Err(err) => WasmOutput::failed(
            err,
            worker.config.name.clone(),
            selected_route.map(|route| route.path.clone()),
        ),
    };

    let mut builder =
        HttpResponse::build(StatusCode::from_u16(handler_result.status).unwrap_or(StatusCode::OK));
    builder.insert_header(("Content-Type", "text/html"));

    if let Some(origins) = app_data.cors_origins.as_ref() {
        if !handler_result.headers.contains_key(CORS_HEADER) {
            let header_value = origins.join(",");
            builder.insert_header((CORS_HEADER, header_value));
        }
    }

    for (key, val) in handler_result.headers.iter() {
        builder.insert_header((key.replace('_', "-").as_str(), val.as_str()));
    }

    match handler_result.body() {
        Ok(res) => builder.body(res),
        Err(_) => HttpResponse::ServiceUnavailable().body("There was an error running the worker"),
    }
}
