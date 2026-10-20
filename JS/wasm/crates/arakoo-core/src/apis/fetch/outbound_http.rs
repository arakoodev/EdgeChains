use std::ops::Deref;

use crate::wit::Method;

use super::arakoo_http::{Request, Response};
use super::wit::edgechains::http::{Request as OutboundRequest, Response as OutboundResponse};
use super::wit::edgechains::http_types::HttpError as OutboundHttpError;
use super::wit::edgechains::http::send_request as outbound_send_request;
use http::{header::HeaderName, HeaderValue};


pub fn send_request(req: Request) -> Result<Response, OutboundHttpError> {
    let (req, body) = req.into_parts();

    let method = req.method.try_into()?;

    let uri = req.uri.to_string();

    let params = vec![];

    let headers = req
        .headers
        .iter()
        .map(try_header_to_strs)
        .collect::<Result<Vec<_>, OutboundHttpError>>()?;

    let body = body.as_ref().map(|bytes| bytes.as_ref());

    let out_req = OutboundRequest {
        method,
        uri,
        params,
        headers,
        body:Some(body.unwrap().to_vec()),
    };

    let OutboundResponse {
        status,
        headers,
        body,
        status_text,
    } = outbound_send_request(&out_req)?;

    let resp_builder = http::response::Builder::new().status(status);
    let resp_builder = headers
        .into_iter()
        .flatten()
        .fold(resp_builder, |b, (k, v)| b.header(k, v));
    resp_builder
        .body(body.map(Into::into))
        .map_err(|_| OutboundHttpError::RuntimeError)
}

fn try_header_to_strs<'k, 'v>(
    header: (&'k HeaderName, &'v HeaderValue),
) -> Result<(String, String), OutboundHttpError> {
    Ok((
        header.0.as_str().to_string(),
        header
            .1
            .to_str()
            .map_err(|_| OutboundHttpError::InvalidUrl)?.to_string(),
    ))
}

impl TryFrom<http::Method> for Method {
    type Error = OutboundHttpError;

    fn try_from(method: http::Method) -> Result<Self,OutboundHttpError> {
        use http::Method;
        use super::wit::Method::*;
        Ok(match method {
            Method::GET => Get,
            Method::POST => Post,
            Method::PUT => Put,
            Method::DELETE => Delete,
            Method::PATCH => Patch,
            Method::HEAD => Head,
            Method::OPTIONS => Options,
            _ => return Err(super::wit::edgechains::http_types::HttpError::RequestError),
        })
    }
}
