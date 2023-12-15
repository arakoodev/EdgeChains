use anyhow::Result;
use std::{
    fs,
    path::{Path, PathBuf},
};

pub const STORE_FOLDER: &str = ".wasmjs";

pub struct Store {
    pub folder: PathBuf,
}

impl Store {
    pub fn create(project_root: &Path, folder: &[&str]) -> Result<Self> {
        let folder = Self::build_root_path(project_root, folder);

        fs::create_dir_all(&folder)?;

        Ok(Self { folder })
    }

    pub fn copy(&self, source: &Path, dest: &[&str]) -> Result<()> {
        let file_path = self.build_folder_path(dest);
        fs::copy(source, file_path)?;
        Ok(())
    }

    pub fn build_folder_path(&self, source: &[&str]) -> PathBuf {
        source
            .iter()
            .fold(self.folder.clone(), |acc, comp| acc.join(comp))
    }

    pub fn file_hash(path: &Path) -> Result<String> {
        let content = fs::read(path)?;

        Ok(blake3::hash(&content).to_string())
    }

    fn build_root_path(root: &Path, source: &[&str]) -> PathBuf {
        source
            .iter()
            .fold(root.join(STORE_FOLDER), |acc, comp| acc.join(comp))
    }
}
