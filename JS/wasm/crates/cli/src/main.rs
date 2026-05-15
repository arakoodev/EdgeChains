use anyhow::bail;
use anyhow::Context;
use anyhow::Result;
use binaryen::CodegenConfig;
use binaryen::Module;
use clap::Parser;
use std::fs;
use std::io::Read;
use std::process::Command;
use std::{env, fs::File, path::PathBuf};
use wit_component::ComponentEncoder;
use wizer::Wizer;

const VERSION: &str = env!("CARGO_PKG_VERSION");

#[derive(Debug, Parser)]
#[clap(
    about = "A utility to convert js to arakoo runtime compatible wasm component",
    version = VERSION
)]
pub struct Options {
    pub input: PathBuf,
    #[arg(short = 'o', default_value = "index.wasm")]
    pub output: PathBuf,
}

fn main() -> Result<()> {
    let opts = Options::parse();
    if env::var("EDECHAINS_JS_WIZEN").eq(&Ok("1".into())) {
        env::remove_var("EDECHAINS_JS_WIZEN");
        // remove unnecessary env var except RUST_LOG
        for (key, _) in env::vars() {
            if key.eq("RUST_LOG") || key.eq("JS_LOG") {
            } else {
                env::remove_var(&key);
            }
        }

        println!("\nStarting to build arakoo compatible module");
        // let wasm: Vec<u8> =
        //     if let Ok(wasm_bytes) = std::fs::read(concat!(env!("OUT_DIR"), "/engine.wasm")) {
        //         wasm_bytes
        //     } else {
        //         // Provide a fallback wasm binary if the file is not found
        //         panic!("Engine wasm not found");
        //     };
        let wasm: &[u8] = include_bytes!(concat!(env!("OUT_DIR"), "/engine.wasm"));

        println!("Preinitializing using Wizer");
        let mut wasm = Wizer::new()
            .allow_wasi(true)?
            .inherit_stdio(true)
            .wasm_bulk_memory(true)
            .inherit_env(true)
            .run(wasm)?;

        let codegen_config = CodegenConfig {
            optimization_level: 3,
            shrink_level: 0,
            debug_info: false,
        };

        println!("Optimizing wasm binary using wasm-opt");

        if let Ok(mut module) = Module::read(&wasm) {
            module.optimize(&codegen_config);
            module
                .run_optimization_passes(vec!["strip"], &codegen_config)
                .expect("Unable to optimize");
            wasm = module.write();
        } else {
            bail!("Unable to read wasm binary for wasm-opt optimizations");
        }

        println!("Adapting module for component model");
        wasm = ComponentEncoder::default()
            .validate(true)
            .module(&wasm)?
            .adapter(
                "wasi_snapshot_preview1",
                include_bytes!(concat!(env!("OUT_DIR"), "/adapter.wasm"))
            )?
            .encode()?;

        fs::write(&opts.output, wasm)?;
        return Ok(());
    }

    let script = File::open(&opts.input)
        .with_context(|| format!("Failed to open input file {}", opts.input.display()))?;

    let self_cmd = env::args().next().expect("No self command");
    env::set_var("EDECHAINS_JS_WIZEN", "1");

    let status = Command::new(self_cmd)
        .arg(&opts.input)
        .arg("-o")
        .arg(&opts.output)
        .stdin(script)
        .status()?;

    if !status.success() {
        anyhow::bail!("Failed to convert js to wasm");
    }

    println!("Arakoo compatible module built successfully");

    Ok(())
}
