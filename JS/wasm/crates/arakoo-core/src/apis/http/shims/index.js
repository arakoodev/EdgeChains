import httpStatus from "http-status";
import Url from "url-parse";
import _queryString from "query-string";
import "fast-text-encoding";

let encoder = new TextEncoder();
let decoder = new TextDecoder();

class URL {
    constructor(urlStr, base = undefined) {
        let url = Url(urlStr, base);
        this.url = url;
        this.protocol = url.protocol;
        this.slashes = url.slashes;
        this.auth = url.auth;
        this.username = url.username;
        this.password = url.password;
        this.host = url.host;
        this.port = url.port;
        this.pathname = url.pathname;
        this.search = url.query;
        this.searchParams = new URLSearchParams(this.search);
        this.hash = url.hash;
        this.href = url.origin;
        this.origin = url.origin;
    }

    set(key, value) {
        this.url.set(key, value);
    }

    toString() {
        return this.url.toString();
    }

    toJson() {
        return this.url.toString();
    }
}

class URLSearchParams {
    queryParams = {};

    constructor(val) {
        this.queryParams = {
            ..._queryString.parse(val),
        };
    }
    append(key, val) {
        this.queryParams[key] = val;
    }
    delete(key) {
        delete this.queryParams[key];
    }
    entries() {
        let arr = [];
        Object.entries(this.queryParams).map((o) => {
            if (Array.isArray(o[1])) {
                o[1].map((k) => {
                    arr.push([o[0], k]);
                });
            } else {
                arr.push([o[0], o[1]]);
            }
        });
        let iterLength = arr.length;
        let iterIndex = 0;
        return {
            next: function () {
                return iterIndex < iterLength
                    ? { value: arr[iterIndex++], done: false }
                    : { done: true };
            },
        };
    }
    get(key) {
        let val = this.queryParams[key];
        if (val) {
            if (typeof val == "object") {
                return val[0];
            }
            return val;
        }
        return null;
    }
    getAll(key) {
        let val = this.queryParams[key];
        if (val) {
            return val;
        }
        return null;
    }
    has(key) {
        return this.queryParams[key] != undefined ? true : false;
    }
    keys() {
        return Object.keys(this.queryParams);
    }
    set(key, val) {
        this.queryParams[key] = val;
    }
    toString() {
        return _queryString.stringify(this.queryParams);
    }
    values() {
        return Object.keys(this.queryParams).map((k) => this.queryParams[k]);
    }
    [Symbol.iterator]() {
        return this.entries();
    }
}

globalThis.URL = URL;
globalThis.URLSearchParams = URLSearchParams;

function atob(b64) {
    return Buffer.from(b64, "base64").toString();
}

function btoa(data) {
    return Buffer.from(data).toString("base64");
}

globalThis.btoa = btoa;
globalThis.atob = atob;

class Headers {
    constructor(initialHeaders) {
        let headers = {};

        for (const key in initialHeaders) {
            let value = initialHeaders[key];

            if (typeof value === "string") {
                headers[key] = value;
            }
        }

        this.headers = headers;
    }

    append(key, value) {
        this.headers[key] = value;
        return value;
    }

    set(key, value) {
        this.append(key, value);
        return value;
    }

    delete(key) {
        let dropValue = delete this.headers[key];
        return dropValue;
    }

    get(key) {
        return this.headers[key];
    }

    toJSON() {
        return this.headers;
    }
}

class Request {
    constructor(url, input) {
        console.debug("Request constructor called with ", JSON.stringify(url), input);
        if (typeof url === "string") {
            this.url = url;
        } else {
            throw new Error("url in Request constructor is not a string");
        }
        this.headers = input.headers;
        this.method = input.method;
        this.body = input.body;
        this.params = input.params || {};
        this.geo = input.geo || {};
    }

    text() {
        return this.body;
    }
}

class Response {
    constructor(body, options = {}) {
        if (body instanceof String) {
            this.body = body.toString();
        } else {
            this.body = body;
        }

        if (options.headers instanceof Headers) {
            this.headers = options.headers;
        } else if (options.headers instanceof Object) {
            this.headers = new Headers(options.headers);
        } else {
            this.headers = new Headers({});
        }

        this.status = options.status || 200;
        this.statusText = options.statusText || httpStatus[this.status];
    }

    static redirect(url, status = 307) {
        return new Response(`Redirecting to ${url}`, {
            status,
            headers: {
                Location: url,
            },
        });
    }

    get ok() {
        return this.status >= 200 && this.status < 300;
    }

    defaultEncoding() {
        return "utf-8";
    }

    arrayBuffer() {
        let parsedBody = this.body;

        if (typeof this.body === "string") {
            try {
                parsedBody = new TextEncoder().encode(this.body);
            } catch (e) {
                return Promise.reject(`err: ${e}`);
            }
        }

        return parsedBody;
    }

    json() {
        let parsedBody = this.body;

        if (typeof this.body !== "string") {
            try {
                parsedBody = new TextDecoder(this.defaultEncoding()).decode(this.body);
            } catch (e) {
                return Promise.reject(`err: ${e}`);
            }
        }

        try {
            return Promise.resolve(JSON.parse(parsedBody));
        } catch (e) {
            return Promise.reject(`err: ${e}`);
        }
    }

    text() {
        let parsedBody = this.body;

        if (typeof this.body !== "string") {
            try {
                parsedBody = new TextDecoder(this.defaultEncoding()).decode(this.body);
            } catch (e) {
                return Promise.reject(`err: ${e}`);
            }
        }

        return parsedBody;
    }

    toString() {
        return this.body;
    }
}

let handlerFunction;
globalThis.addEventListener = (_eventName, handler) => {
    handlerFunction = handler;
};

const requestToHandler = (inputReq) => {
    const request = new Request(inputReq.uri, inputReq);
    console.debug("Request recieved ", JSON.stringify(request));
    const event = {
        request,
        response: {},
        respondWith(res) {
            console.debug(res.constructor.name);
            this.response = res;
        },
    };

    try {
        handlerFunction(event);

        Promise.resolve(event.response)
            .then((res) => {
                console.log("Successfully responded to request");
                result = {
                    body: res.body,
                    headers: res.headers.headers,
                    status: res.status,
                    statusText: res.statusText,
                };
            })
            .catch((err) => {
                error = `err: \n${err}`;
            });
    } catch (err) {
        error = `err: ${err}\n${err.stack}`;
    }
};

globalThis.entrypoint = requestToHandler;
globalThis.result = {};
globalThis.error = null;

// globalThis.fetch = async (resource, options = { method: "GET" }) => {
//     let response = await fetch_internal(resource, options);
//     return Promise.resolve(new Response(response.body, response));
// };

function encodeBody(body) {
    if (typeof body == "string") {
        return encoder.encode(body).buffer;
    } else if (ArrayBuffer.isView(body)) {
        return body.buffer;
    } else {
        return body;
    }
}

// globalThis.requestToEvent = (inputReq) => {
//     const request = new Request(inputReq);
//     const event = {
//         request,
//         response: {},
//         respondWith(res) {
//             console.log("Response recieved ", res);
//             this.response = res;
//         },
//     };
//     console.log("event: ", JSON.stringify(event))
//     return event;
// }

function fetch(uri, options) {
    console.info("constructor name of uri ", uri.constructor.name);
    console.info("uri is ", JSON.stringify(uri));
    if (uri.constructor.name == "Request") {
        console.info("uri is instance of Request");
        options = {};
        options.headers = uri.headers;
        options.method = uri.method;
        options.params = uri.params;
        options.body = uri.body;
        options.geo = uri.geo;
        uri = uri.url;
    }
    console.info("In fetch function", uri, options);
    let encodedBodyData =
        options && options.body ? encodeBody(options.body) : new Uint8Array().buffer;
    const { status, headers, body } = __internal_http_send({
        method: (options && options.method) || "GET",
        uri: uri instanceof URL ? uri.toString() : uri,
        headers: (options && options.headers) || {},
        body: encodedBodyData,
        params: (options && options.params) || {},
    });
    console.info("Response from fetch", status, headers, body);
    let obj;
    try {
        obj = {
            status,
            headers: {
                entries: () => Object.entries(headers || {}),
                get: (key) => (headers && headers[key]) || null,
                has: (key) => (headers && headers[key] ? true : false),
            },
            arrayBuffer: () => Promise.resolve(body),
            ok: status > 199 && status < 300,
            statusText: httpStatus[status],
            text: () => Promise.resolve(new TextDecoder().decode(body || new Uint8Array())),
            json: () => {
                let text = new TextDecoder().decode(body || new Uint8Array());
                return Promise.resolve(JSON.parse(text));
            },
        };
    } catch (error) {
        console.log("Error occured in sending response from fetch");
        console.log(error);
    }
    return Promise.resolve(obj);
}
