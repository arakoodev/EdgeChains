//! Error types.

use thiserror::Error;
use wiggle::GuestError;

#[derive(Debug, Error)]
#[non_exhaustive]
pub enum Error {
    #[error("Buffer length error: {buf} too long to fit in {len}")]
    BufferLengthError {
        buf: &'static str,
        len: &'static str,
    },
    #[error("Invalid argument given")]
    InvalidArgument,
    #[error(transparent)]
    GeolocationError(#[from] crate::wiggle_abi::geo_impl::GeolocationError),
    #[error("Shared memory not supported yet")]
    SharedMemory,
    #[error("Guest error: [{0}]")]
    GuestError(#[from] GuestError),
}

/// Errors that may occur while validating geolocation configurations.
#[derive(Debug, Error)]
pub enum GeolocationConfigError {
    #[error(transparent)]
    IoError(std::io::Error),

    #[error("definition was not provided as a TOML table")]
    InvalidEntryType,

    #[error("missing 'file' field")]
    MissingFile,

    #[error("'file' field is empty")]
    EmptyFileEntry,

    #[error("missing 'addresses' field")]
    MissingAddresses,

    #[error("inline geolocation value was not a string")]
    InvalidInlineEntryType,

    #[error("'file' field was not a string")]
    InvalidFileEntry,

    #[error("'addresses' was not provided as a TOML table")]
    InvalidAddressesType,

    // #[error("unrecognized key '{0}'")]
    // UnrecognizedKey(String),

    // #[error("missing 'format' field")]
    // MissingFormat,

    #[error("'format' field was not a string")]
    InvalidFormatEntry,

    #[error("IP address not valid: '{0}'")]
    InvalidAddressEntry(String),

    #[error("'{0}' is not a valid format for the geolocation mapping. Supported format(s) are: 'inline-toml', 'json'.")]
    InvalidGeolocationMappingFormat(String),

    #[error(
    "The file is of the wrong format. The file is expected to contain a single JSON Object"
    )]
    GeolocationFileWrongFormat,

    #[error("'format' field is empty")]
    EmptyFormatEntry,

    // #[error("Item value under key named '{key}' is of the wrong format. The value is expected to be a JSON String")]
    // GeolocationItemValueWrongFormat { key: String },
}

#[derive(Debug, Error)]
pub enum ArakooConfigError {

    #[error("invalid configuration for '{name}': {err}")]
    InvalidGeolocationDefinition {
        name: String,
        #[source]
        err: GeolocationConfigError,
    },

    #[error("error parsing `edge.toml`: {0}")]
    InvalidArakooToml(#[from] toml::de::Error),

   #[error("invalid manifest version: {0}")]
    InvalidManifestVersion(#[from] semver::SemVerError),

    /// An I/O error that occurred while reading the file.
    #[error("error reading '{path}': {err}")]
    IoError {
        path: String,
        #[source]
        err: std::io::Error,
    },
    // #[error("error reading: {err}")]
    // TomlError { err: toml::de::Error },
}
