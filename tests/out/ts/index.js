"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.overloadedString = exports.arrowResult = exports.arrow = exports.email = exports.defaultResult = exports.overloadedEarly = exports.earlyResult = exports.decoB = exports.decoA = exports.calls = void 0;
exports.hoisted = hoisted;
exports.overloaded = overloaded;
exports.default = defaulted;
exports.calls = [];
const decoA = (fn) => {
    return function (...args) {
        exports.calls.push("A");
        return fn.apply(this, args);
    };
};
exports.decoA = decoA;
const decoB = (fn) => {
    return function (...args) {
        exports.calls.push("B");
        return fn.apply(this, args);
    };
};
exports.decoB = decoB;
exports.earlyResult = hoisted(2);
exports.overloadedEarly = overloaded(5);
exports.defaultResult = defaulted(7);
exports.email = "a@b.com";
var __decorated_hoisted_1;
function hoisted(x) {
    if (__decorated_hoisted_1 === void 0) {
        __decorated_hoisted_1 = decoA(decoB(function (x) {
            return x + 1;
        }));
    }
    return __decorated_hoisted_1.apply(this, arguments);
}
var __decorated_overloaded_1;
function overloaded(x) {
    if (__decorated_overloaded_1 === void 0) {
        __decorated_overloaded_1 = decoB(function (x) {
            return typeof x === "number" ? x + 1 : `${x}!`;
        });
    }
    return __decorated_overloaded_1.apply(this, arguments);
}
var __decorated_defaulted_1;
function defaulted(x) {
    if (__decorated_defaulted_1 === void 0) {
        __decorated_defaulted_1 = decoA(function (x) {
            return x + 10;
        });
    }
    return __decorated_defaulted_1.apply(this, arguments);
}
exports.arrow = decoA((x) => x * 2);
exports.arrowResult = (0, exports.arrow)(3);
exports.overloadedString = overloaded("ok");
