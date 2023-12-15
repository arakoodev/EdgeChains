use std::process::Command;

fn main() {
    Command::new("npm")
        .current_dir("shims")
        .arg("install")
        .status()
        .unwrap();

    Command::new("npm")
        .current_dir("shims")
        .args(["run", "build"])
        .status()
        .unwrap();

    println!("cargo:rerun-if-changed=shims/package.json");
    println!("cargo:rerun-if-changed=shims/build.js");
    println!("cargo:rerun-if-changed=shims/src/*.js");
}
