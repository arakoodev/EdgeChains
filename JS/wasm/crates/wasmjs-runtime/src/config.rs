use crate::bindings::HttpRequestsConfig;
use anyhow::Result;
use serde::Deserialize;
use serde::Deserializer;
use std::collections::HashMap;
use std::{env, fs};
use std::path::{Path, PathBuf};
use std::str::FromStr;
use toml::Table;
use crate::error::ArakooConfigError;
use crate::geolocation::Geolocation;

#[derive(Deserialize, Clone, Default)]
#[serde(default)]
pub struct Features {
    pub http_requests: HttpRequestsConfig,
    pub geo: ArakooConfig
}

#[derive(Deserialize, Clone, Default)]
pub struct Folder {
    #[serde(deserialize_with = "deserialize_path", default)]
    pub from: PathBuf,
    pub to: String,
}

fn deserialize_path<'de, D>(deserializer: D) -> Result<PathBuf, D::Error>
where
    D: Deserializer<'de>,
{
    let result: Result<String, D::Error> = Deserialize::deserialize(deserializer);

    match result {
        Ok(value) => {
            let split = if value.contains('/') {
                value.split('/')
            } else {
                value.split('\\')
            };

            Ok(split.fold(PathBuf::new(), |mut acc, el| {
                acc.push(el);
                acc
            }))
        }
        Err(err) => Err(err),
    }
}

#[derive(Debug, Clone, Deserialize)]
pub struct ArakooConfig {
    pub(crate) local_server: LocalServerConfig,
}

impl Default for ArakooConfig {
    fn default() -> Self {
        ArakooConfig{
            local_server: LocalServerConfig::default()
        }
    }
}

impl ArakooConfig {
    pub fn geolocation(&self) -> &Geolocation {
        &self.local_server.geolocation
    }
    pub fn from_file(path: impl AsRef<Path>) -> Result<Self, ArakooConfigError> {
        fs::read_to_string(path.as_ref())
            .map_err(|err| ArakooConfigError::IoError {
                path: path.as_ref().display().to_string(),
                err,
            })
            .and_then(Self::from_str)
    }

    /// Parse a string containing TOML data into a `ArakooConfig`.
    fn from_str(toml: impl AsRef<str>) -> Result<Self, ArakooConfigError> {
        toml::from_str::<TomlArakooConfig>(toml.as_ref())
            .map_err(Into::into)
            .and_then(TryInto::try_into)
    }

}

impl FromStr for ArakooConfig {
    type Err = ArakooConfigError;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        Self::from_str(s)
    }
}

#[derive(Deserialize)]
struct TomlArakooConfig {
    local_server: Option<RawLocalServerConfig>,
}

impl TryInto<ArakooConfig> for TomlArakooConfig {
    type Error = ArakooConfigError;
    fn try_into(self) -> Result<ArakooConfig, Self::Error> {
        let Self {
            local_server,
        } = self;
        let local_server: LocalServerConfig = local_server
            .map(TryInto::try_into)
            .transpose()?
            .unwrap_or_default();
        Ok(ArakooConfig {
            local_server,
        })
    }
}

#[derive(Deserialize, Clone, Default)]
pub struct Config {
    pub name: Option<String>,
    #[serde(default)]
    pub features: Features,
    pub folders: Option<Vec<Folder>>,
    #[serde(deserialize_with = "read_environment_variables", default)]
    pub vars: HashMap<String, String>,
}

fn read_environment_variables<'de, D>(
    deserializer: D,
) -> core::result::Result<HashMap<String, String>, D::Error>
where
    D: Deserializer<'de>,
{
    let result: core::result::Result<Option<HashMap<String, String>>, D::Error> =
        Deserialize::deserialize(deserializer);

    match result {
        Ok(value) => match value {
            Some(mut options) => {
                for (_, value) in options.iter_mut() {
                    if value.starts_with('$') && !value.contains(' ') {
                        value.remove(0);

                        match env::var(&value) {
                            Ok(env_value) => *value = env_value,
                            Err(_) => *value = String::new(),
                        }
                    }
                }

                Ok(options)
            }
            None => Ok(HashMap::new()),
        },
        Err(err) => Err(err),
    }
}

#[derive(Clone, Debug, Default, Deserialize, )]
pub struct LocalServerConfig {
    geolocation: Geolocation,
}


#[derive(Deserialize)]
struct RawLocalServerConfig {
    geolocation: Option<Table>,
}

impl TryInto<LocalServerConfig> for RawLocalServerConfig {
    type Error = ArakooConfigError;
    fn try_into(self) -> Result<LocalServerConfig, Self::Error> {
        let Self {
            geolocation,
        } = self;
        let geolocation = if let Some(geolocation) = geolocation {
            geolocation.try_into()?
        } else {
            Geolocation::default()
        };

        Ok(LocalServerConfig {
            geolocation,
        })
    }
}
