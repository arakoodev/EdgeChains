use std::path::PathBuf;

use actix_web::{
    App,
    HttpServer,
    middleware, web::{self, Data},
};
use actix_web::dev::Server;
use actix_web::HttpRequest;
use actix_web::web::Bytes;
use anyhow::{Ok, Result};

use crate::handlers::handle_worker;
use crate::routes::Routes;

#[derive(Clone)]
pub struct ServeOptions {
    pub root_path: PathBuf,
    pub config_path: Option<PathBuf>,
    pub base_routes: Routes,
    pub hostname: String,
    pub port: u16,
    pub cors_origins: Option<Vec<String>>,
}

#[derive(Default)]
pub struct AppData {
    pub routes: Routes,
    pub root_path: PathBuf,
    pub cors_origins: Option<Vec<String>>,
}

impl From<ServeOptions> for AppData {
    fn from(serve_options: ServeOptions) -> Self {
        AppData {
            routes: serve_options.base_routes,
            root_path: serve_options.root_path.clone(),
            cors_origins: serve_options.cors_origins,
        }
    }
}

pub async fn serve(serve_options: ServeOptions) -> Result<Server> {
    let (hostname, port) = (serve_options.hostname.clone(), serve_options.port);
    let serve_options = serve_options.clone();

    let server = HttpServer::new(move || {
        let app_data: Data<AppData> =
            Data::new(<ServeOptions as TryInto<AppData>>::try_into(serve_options.clone()).unwrap());

        let mut app = App::new()
            .wrap(middleware::Logger::default())
            .wrap(middleware::NormalizePath::trim())
            .app_data(Data::clone(&app_data));

        for route in app_data.routes.iter() {
            app = app.service(web::resource(route.actix_path()).to(handle_worker));
        }

        app
    })
    .bind(format!("{}:{}", hostname, port))?;

    Ok(server.run())
}

pub async fn run(serve_options: ServeOptions) -> Result<()> {

    let app_data: Data<AppData> =
        Data::new(<ServeOptions as TryInto<AppData>>::try_into(serve_options).unwrap());
    let request = actix_web::test::TestRequest::with_uri("/").app_data(app_data.clone()).to_http_request();
    let request_jsonnet = actix_web::test::TestRequest::with_uri("/jsonnet").app_data(app_data).to_http_request();
        let body: Bytes = Bytes::from("");
    let req = HttpRequest::from(request);
    let req_jsonnet = HttpRequest::from(request_jsonnet);

    let res = handle_worker(req, body.clone()).await;
    let res_jsonnet = handle_worker(req_jsonnet,body).await;
    // print body of response
    let res_body = res.body();
    println!("{:?}", res_body);
    let res_body = res_jsonnet.body();
    println!("{:?}", res_body);

    Ok(())
}
