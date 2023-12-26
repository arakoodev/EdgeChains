use std::{
    collections::HashMap,
    ffi::OsStr,
    path::{Component, Path, PathBuf},
    str::FromStr,
    sync::{Arc, RwLock},
};

use lazy_static::lazy_static;
use regex::Regex;
use wax::{Glob, WalkEntry};
use crate::ServeArgs;

use crate::{store::STORE_FOLDER, workers::Worker};

pub struct Files<'t> {
    root: PathBuf,
    include_pattern: Glob<'t>,
    ignore_patterns: Vec<Glob<'t>>,
}

impl<'t> Files<'t> {
    const DEFAULT_EXTENSIONS: [&'static str; 1] = ["js"];

    pub fn new(root: &Path, file_extensions: Vec<String>) -> Self {
        Self {
            root: root.to_path_buf(),
            include_pattern: Self::build_include_pattern(file_extensions),
            ignore_patterns: Self::build_ignore_patterns(vec![]),
        }
    }

    pub fn walk(&self) -> Vec<WalkEntry> {
        self.include_pattern
            .walk(&self.root)
            .not(self.ignore_patterns.clone())
            .expect("Failed to walk the tree when processing files in the current directory")
            .map(|e| e.unwrap())
            .collect()
    }

    fn build_include_pattern(file_extensions: Vec<String>) -> Glob<'t> {
        let mut file_extensions = file_extensions;
        for default_extension in Self::DEFAULT_EXTENSIONS {
            file_extensions.push(default_extension.to_string());
        }

        let include_pattern = format!("**/*.{{{}}}", file_extensions.join(","));
        Glob::from_str(include_pattern.as_str()).unwrap()
    }

    fn build_ignore_patterns(ignore_patterns: Vec<String>) -> Vec<Glob<'t>> {
        let default_ignore_patterns = vec![format!("**/{}/**", STORE_FOLDER)];

        let mut result = default_ignore_patterns;
        result.extend(ignore_patterns);
        result
            .iter()
            .map(|s| Glob::from_str(s.as_str()).unwrap())
            .collect()
    }
}

#[derive(Clone, Default, Debug)]
pub struct Routes {
    pub routes: Vec<Route>,
}

impl Routes {
    pub fn new(path: &Path, args: &ServeArgs) -> Self {
        let mut routes = Vec::new();
        let runtime_extensions = vec![String::from("js")];

        let files = Files::new(path, runtime_extensions);

        let mut route_paths: Vec<PathBuf> = Vec::new();
        for entry in files.walk() {
            route_paths.push(entry.into_path());
        }

        for route_path in route_paths {
            routes.push(Route::new(path, route_path, args));
        }

        Self { routes }
    }

    pub fn iter(&self) -> impl Iterator<Item = &Route> {
        self.routes.iter()
    }

    pub fn retrieve_best_route<'a>(&'a self, path: &str) -> Option<&'a Route> {
        self.iter().find(|r| r.can_manage(path))
    }
}

lazy_static! {
    static ref PARAMETER_REGEX: Regex =
        Regex::new(r"\[(?P<ellipsis>\.{3})?(?P<segment>\w+)\]").unwrap();
    pub static ref WORKERS: RwLock<WorkerSet> = RwLock::new(WorkerSet::default());
}

#[derive(PartialEq, Eq, Debug, Clone)]
pub enum RouteType {
    Tail { number_of_segments: usize },
}

impl From<&String> for RouteType {
    fn from(route_path: &String) -> Self {
        let number_of_segments = route_path.chars().filter(|&c| c == '/').count();
        RouteType::Tail { number_of_segments }
    }
}

#[derive(PartialEq, Eq, Debug, Clone)]
pub enum Segment {
    Tail(String),
}

impl From<&str> for Segment {
    fn from(segment: &str) -> Self {
        Segment::Tail(segment.to_owned())
    }
}

#[derive(Clone, Debug)]
pub struct Route {
    pub handler: PathBuf,
    pub path: String,
    pub route_type: RouteType,
    pub segments: Vec<Segment>,
    pub worker: String,
}

#[derive(Default)]
pub struct WorkerSet {
    workers: HashMap<String, Arc<Worker>>,
}

impl WorkerSet {
    pub fn get(&self, worker_id: &str) -> Option<&Arc<Worker>> {
        self.workers.get(worker_id)
    }

    pub fn register(&mut self, worker_id: String, worker: Worker) {
        self.workers.insert(worker_id, Arc::new(worker));
    }
}

impl Route {
    pub fn new(base_path: &Path, filepath: PathBuf, args: &ServeArgs) -> Self {
        let worker = Worker::new(base_path, &filepath, args).unwrap();
        let worker_id = worker.id.clone();

        WORKERS.write().unwrap().register(worker_id.clone(), worker);
        let route_path = Self::retrieve_route(base_path, &filepath);
        Self {
            handler: filepath,
            route_type: RouteType::from(&route_path),
            segments: Self::get_segments(&route_path),
            path: route_path,
            worker: worker_id.clone(),
        }
    }

    fn retrieve_route(base_path: &Path, path: &Path) -> String {
        let n_path = Self::normalize_path_to_url(path);
        let n_base_path = Self::normalize_path_to_url(base_path);

        match n_path.strip_prefix(&n_base_path) {
            Some(worker_path) => if worker_path.is_empty() {
                "/"
            } else {
                worker_path
            }
            .into(),
            None => String::from("/unknown"),
        }
    }

    fn normalize_path_to_url(path: &Path) -> String {
        path.with_extension("")
            .components()
            .filter_map(|c| match c {
                Component::Normal(os_str) if os_str != OsStr::new("index") => os_str
                    .to_str()
                    .map(|parsed_str| String::from("/") + parsed_str),
                _ => None,
            })
            .collect()
    }

    fn get_segments(route_path: &str) -> Vec<Segment> {
        route_path.split('/').skip(1).map(Segment::from).collect()
    }

    pub fn can_manage(&self, path: &str) -> bool {
        let path_number_of_segments = path.chars().filter(|&c| c == '/').count();

        match self.route_type {
            RouteType::Tail { number_of_segments }
                if number_of_segments > path_number_of_segments =>
            {
                false
            }
            RouteType::Tail { .. } => true,
        }
    }

    pub fn actix_path(&self) -> String {
        PARAMETER_REGEX
            .replace_all(&self.path, |caps: &regex::Captures| {
                match (caps.name("ellipsis"), caps.name("segment")) {
                    (Some(_), Some(segment)) => format!("{{{}:.*}}", segment.as_str()),
                    (_, Some(segment)) => format!("{{{}}}", segment.as_str()),
                    _ => String::new(),
                }
            })
            .into()
    }

    pub fn is_dynamic(&self) -> bool {
        match self.route_type {
            RouteType::Tail { .. } => true,
        }
    }
}

impl Eq for Route {}

impl PartialEq for Route {
    fn eq(&self, other: &Self) -> bool {
        self.path == other.path
    }
}
