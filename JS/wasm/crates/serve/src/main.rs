use anyhow::{Ok, Result};
use serve::WorkerCtx;
use std::env;

#[tokio::main]
async fn main() -> Result<()> {
    let wasm_path = env::args().nth(1).expect("Expected path to wasm file");
    let path = std::path::Path::new(&wasm_path);
    if !path.exists() {
        panic!("File not found: {}", wasm_path);
    }
    let addr = env::args().nth(2).unwrap_or("127.0.0.1".to_string());
    let port = env::args().nth(3).unwrap_or("8080".to_string());
    let addr = format!("{}:{}", addr, port)
        .parse()
        .expect("Invalid address");
    WorkerCtx::new(path)?.serve(addr).await?;

    Ok(())
}
