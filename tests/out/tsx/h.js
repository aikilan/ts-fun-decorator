"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.h = h;
function h(tag, props, ...children) {
    return { tag, props: props !== null && props !== void 0 ? props : null, children };
}
