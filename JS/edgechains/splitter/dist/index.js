"use strict";
var d = Object.create;
var l = Object.defineProperty;
var f = Object.getOwnPropertyDescriptor;
var g = Object.getOwnPropertyNames;
var T = Object.getPrototypeOf,
    b = Object.prototype.hasOwnProperty;
var j = (t, r) => () => (r || t((r = { exports: {} }).exports, r), r.exports),
    k = (t, r) => {
        for (var e in r) l(t, e, { get: r[e], enumerable: !0 });
    },
    p = (t, r, e, n) => {
        if ((r && typeof r == "object") || typeof r == "function")
            for (let s of g(r))
                !b.call(t, s) &&
                    s !== e &&
                    l(t, s, { get: () => r[s], enumerable: !(n = f(r, s)) || n.enumerable });
        return t;
    };
var m = (t, r, e) => (
        (e = t != null ? d(T(t)) : {}),
        p(r || !t || !t.__esModule ? l(e, "default", { value: t, enumerable: !0 }) : e, t)
    ),
    v = (t) => p(l({}, "__esModule", { value: !0 }), t);
var h = j((u) => {
    "use strict";
    Object.defineProperty(u, "__esModule", { value: !0 });
    u.TextSplitter = void 0;
    var c = class {
        splitTextIntoChunks(r, e) {
            return new Promise((n, s) => {
                try {
                    r = r
                        .split(
                            `
`
                        )
                        .join(" ");
                    let o = [];
                    for (let i = 0; i < r.length; i += e) o.push(r.substring(i, i + e));
                    n(o);
                } catch (o) {
                    console.error("Error splitting text into chunks:", o), s(o);
                }
            });
        }
    };
    u.TextSplitter = c;
});
var x = {};
k(x, { TextSplitter: () => a.TextSplitter });
module.exports = v(x);
var a = m(h());
0 && (module.exports = { TextSplitter });
