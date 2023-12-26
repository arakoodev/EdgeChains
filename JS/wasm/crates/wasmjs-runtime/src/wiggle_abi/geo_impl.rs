use crate::bindings::types::ArakooStatus;

#[derive(Debug, thiserror::Error)]
pub enum GeolocationError {
    /// Geolocation data for given address not found.
    #[error("No geolocation data: {0}")]
    NoGeolocationData(String),
}

impl GeolocationError {
    /// Convert to an error code representation suitable for passing across the ABI boundary.
    pub fn to_aradoo_status(&self) -> ArakooStatus {
        use GeolocationError::*;
        match self {
            NoGeolocationData(_) => ArakooStatus::None,
        }
    }
}
