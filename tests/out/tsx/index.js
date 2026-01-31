"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tag = exports.rendered = exports.jsxAt = exports.earlyResult = exports.deco = exports.calls = void 0;
exports.hello = hello;
const h_1 = require("./h");
exports.calls = [];
const deco = (fn) => {
    return function (...args) {
        exports.calls.push("D");
        const result = fn.apply(this, args);
        if (result && Array.isArray(result.children)) {
            return result.children.join("");
        }
        return result;
    };
};
exports.deco = deco;
exports.earlyResult = hello({ name: "X" });
exports.jsxAt = (0, h_1.h)("div", null, "@decorator");
var __decorated_hello_1;
function hello(props) {
    if (__decorated_hello_1 === void 0) {
        __decorated_hello_1 = deco(function (props) {
            return (0, h_1.h)("div", null,
                "hi:",
                props.name);
        });
    }
    return __decorated_hello_1.apply(this, arguments);
}
exports.rendered = hello({ name: "Y" });
exports.tag = (0, h_1.h)("div", null, "ok").tag;
