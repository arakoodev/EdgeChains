use std::path::PathBuf;

use clap::{Args, Parser, Subcommand};

use routes::Routes;
use server::run;

use crate::server::{serve, ServeOptions};

mod bindings;
mod config;
mod error;
mod geolocation;
mod handlers;
mod io;
mod routes;
mod runtime;
mod server;
mod store;
mod wiggle_abi;
mod workers;

#[derive(Parser, Debug)]
#[command(author, version, about, long_about = None)]
#[command(propagate_version = true)]
#[command(args_conflicts_with_subcommands = true)]
pub struct Opts {
    #[command(subcommand)]
    pub command: Option<Command>,
    #[command(flatten)]
    pub args: ServeArgs,
}

#[derive(Debug, Clone, Subcommand)]
pub enum Command {
    Server(ServeArgs),
    Run(ServeArgs),
}

#[derive(Debug, Args, Clone)]
pub struct ServeArgs {
    #[arg(value_parser, default_value = ".")]
    path: PathBuf,
    #[arg(short = 'C', long = "config")]
    config_path: Option<PathBuf>,
    #[arg(long = "host", default_value = "0.0.0.0")]
    hostname: String,
    #[arg(short, long, default_value_t = 8080)]
    port: u16,
    #[arg(long)]
    cors: Option<Vec<String>>,
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    // let args = Args::parse();
    let opt = Opts::parse();
    let cmd = opt.command.unwrap_or(Command::Server(opt.args));
    match cmd {
        Command::Server(args) => {
            let routes = Routes::new(&args.path, &args);
            for route in routes.routes.iter() {
                println!(
                    "- http://{}:{}{}\n      => {}",
                    &args.hostname,
                    args.port,
                    route.path,
                    route.handler.to_string_lossy()
                );
            }

            let server = serve(ServeOptions {
                root_path: args.path.clone(),
                config_path: args.config_path,
                base_routes: routes,
                hostname: args.hostname,
                port: args.port,
                cors_origins: args.cors,
            })
            .await
            .unwrap();

            server.await
        }
            Command::Run(args) => {
            let routes = Routes::new(&args.path, &args);
            let serve_options = ServeOptions {
                root_path: args.path.clone(),
                config_path: args.config_path,
                base_routes: routes,
                hostname: args.hostname,
                port: args.port,
                cors_origins: args.cors,
            };
                run(serve_options).await.map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e.to_string()))
        }
    }
}
