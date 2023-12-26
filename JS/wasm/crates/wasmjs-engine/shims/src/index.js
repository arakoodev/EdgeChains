// import { URLSearchParams } from "@ungap/url-search-params";
import { TextEncoder, TextDecoder } from "@sinonjs/text-encoding";
import httpStatus from "http-status";
import Url from 'url-parse'
import _queryString from 'query-string';

class URL {

    constructor(urlStr, base = undefined) {
        let url = Url(urlStr, base)
        this.url = url
        this.protocol = url.protocol
        this.slashes = url.slashes
        this.auth = url.auth
        this.username = url.username
        this.password = url.password
        this.host = url.host
        this.port = url.port
        this.pathname = url.pathname
        this.search = url.query
        this.searchParams = new URLSearchParams(this.search)
        this.hash = url.hash
        this.href = url.origin
        this.origin = url.origin
    }

    set(key, value) {
        this.url.set(key, value)
    }

    toString() {
        return this.url.toString()
    }

    toJson() {
        return this.url.toString()
    }

}

class URLSearchParams {
    queryParams = {}

    constructor(val) {
        this.queryParams = {
            ..._queryString.parse(val)
        }
    }
    append(key, val) {
        this.queryParams[key] = val
    }
    delete(key) {
        delete this.queryParams[key]
    }
    entries() {
        let arr = []
        Object.entries(this.queryParams).map(o => {
            if (Array.isArray(o[1])) {
                o[1].map(k => {
                    arr.push([o[0], k])
                })
            } else {
                arr.push([o[0], o[1]])
            }
        })
        let iterLength = arr.length
        let iterIndex = 0
        return {
            next: function () {
                return iterIndex < iterLength ?
                    { value: arr[iterIndex++], done: false } :
                    { done: true };
            }
        }
    }
    get(key) {
        let val = this.queryParams[key]
        if (val) {
            if (typeof (val) == "object") {
                return val[0]
            }
            return val
        }
        return null
    }
    getAll(key) {
        let val = this.queryParams[key]
        if (val) {
            return val
        }
        return null
    }
    has(key) {
        return this.queryParams[key] != undefined ? true : false
    }
    keys() {
        return Object.keys(this.queryParams)
    }
    set(key, val) {
        this.queryParams[key] = val
    }
    toString() {
        return _queryString.stringify(this.queryParams)
    }
    values() {
        return Object.keys(this.queryParams).map(k => this.queryParams[k])
    }
    [Symbol.iterator]() {
        return this.entries()
    }
}

globalThis.URL = URL;
globalThis.URLSearchParams = URLSearchParams;

function atob(b64) {
    return Buffer.from(b64, "base64").toString()
}

function btoa(data) {
    return Buffer.from(data).toString('base64')
}

globalThis.btoa = btoa;
globalThis.atob = atob;

function require(path) {
    return globalThis[path];
}

globalThis.require = require;
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
    constructor(input) {
        this.url = input.url;
        this.method = input.method;
        this.headers = new Headers(input.headers || {});
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
                Location: url
            }
        })
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

(function () {
    const __send_http_request = globalThis.__send_http_request;
    const __console_log = globalThis.__console_log;

    globalThis.fetch = (uri, opts) => {
        let optsWithDefault = {
            method: "GET",
            headers: {},
            body: null,
            ...opts
        };

        if (optsWithDefault.body !== null && typeof optsWithDefault.body !== "string") {
            try {
                optsWithDefault.body = new TextEncoder().encode(optsWithDefault.body);
            } catch (e) {
                return Promise.reject(`err: ${e}`)
            }
        }

        let result = __send_http_request(uri, optsWithDefault);

        if (result.error === true) {
            return Promise.reject(new Error(`[${result.type}] ${result.message}`));
        } else {
            let response = new Response(result.body, {
                headers: result.headers,
                status: result.status,
            })

            return Promise.resolve(response);
        }
    }


    globalThis.console = {
        error(msg) {
            this.log(msg);
        },
        log(msg) {
            __console_log(msg);
        },
        info(msg) {
            this.log(msg);
        },
        debug(msg) {
            this.log(msg);
        },
        warn(msg) {
            this.log(msg);
        },
        trace(msg) {
            this.log(msg);
        }
    }

    Reflect.deleteProperty(globalThis, "__send_http_request");
    Reflect.deleteProperty(globalThis, "__console_log");
})();

globalThis.TextEncoder = TextEncoder;
globalThis.TextDecoder = TextDecoder;

let handlerFunction;

globalThis.addEventListener = (_eventName, handler) => {
    handlerFunction = handler;
};

const requestToHandler = input => {
    const request = new Request(input);
    const event = {
        request,
        response: {},
        respondWith(res) {
            this.response = res;
        }
    };

    try {
        handlerFunction(event);

        Promise.resolve(
            event.response
        ).then(res => {
            result = {
                data: res.body,
                headers: res.headers.headers,
                status: res.status,
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
globalThis.error = null
