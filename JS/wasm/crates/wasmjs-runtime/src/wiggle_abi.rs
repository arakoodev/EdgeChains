pub mod geo_impl;
use std::net::{IpAddr, Ipv4Addr, Ipv6Addr};
use std::sync::Arc;
use wiggle::GuestPtr;

use crate::bindings::arakoo_geo::ArakooGeo;
use crate::geolocation::Geolocation;
use crate::wiggle_abi::geo_impl::GeolocationError;
use crate::error::Error;

pub struct Session {
    geolocation: Arc<Geolocation>,
}

impl Session {
    pub fn geolocation_lookup(&self, addr: &IpAddr) -> Option<String> {
        self.geolocation.lookup(addr).map(|data| data.to_string())
    }
}

impl ArakooGeo for Session {
    fn lookup(
        &mut self,
        addr_octets: &GuestPtr<u8>,
        addr_len: u32,
        buf: &GuestPtr<u8>,
        buf_len: u32,
        nwritten_out: &GuestPtr<u32>,
    ) -> Result<(), Error> {
        let octets = addr_octets
            .as_array(addr_len)
            .iter()
            .map(|v| v.unwrap().read().unwrap())
            .collect::<Vec<u8>>();

        let ip_addr: IpAddr = match addr_len {
            4 => IpAddr::V4(Ipv4Addr::from(
                TryInto::<[u8; 4]>::try_into(octets).unwrap(),
            )),
            16 => IpAddr::V6(Ipv6Addr::from(
                TryInto::<[u8; 16]>::try_into(octets).unwrap(),
            )),
            _ => return Err(Error::InvalidArgument),
        };

        let result = self
            .geolocation_lookup(&ip_addr)
            .ok_or_else(|| GeolocationError::NoGeolocationData(ip_addr.to_string()))?;

        if result.len() > buf_len as usize {
            return Err(Error::BufferLengthError {
                buf: "geolocation_lookup",
                len: "geolocation_lookup_max_len",
            });
        }

        let result_len =
            u32::try_from(result.len()).expect("smaller than value_max_len means it must fit");

        let mut buf_ptr = buf
            .as_array(result_len)
            .as_slice_mut()?
            .ok_or(Error::SharedMemory)?;
        buf_ptr.copy_from_slice(result.as_bytes());
        nwritten_out.write(result_len)?;
        Ok(())
    }
}

