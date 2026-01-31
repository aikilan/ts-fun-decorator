import {
  createDecorator,
  type DecoratorContext,
  createAsyncDecorator,
  mapReturn,
  mapReturnAsync
} from "ts-fun-decorator/runtime";

export type Role = "user" | "admin";

type AnyFn = (...args: any[]) => any;

let currentRole: Role = "user";

export const getRole = (): Role => currentRole;
export const setRole = (role: Role): void => {
  currentRole = role;
};

export class PermissionError extends Error {
  requiredRole: Role;

  constructor(role: Role) {
    super(`Need role: ${role}`);
    this.requiredRole = role;
  }
}

export { createDecorator, createAsyncDecorator, mapReturn, mapReturnAsync };
export type { DecoratorContext };

const baseLog = (label: string) =>
  createDecorator<AnyFn>((next, ctx) => {
    console.log(`[log] ${label}`, ...ctx.args);
    const result = next();
    console.log(`[log] ${label} =>`, result);
    return result;
  });

export function log<T extends AnyFn>(fn: T): T;
export function log(label: string): <T extends AnyFn>(fn: T) => T;
export function log(arg: string | AnyFn) {
  if (typeof arg === "function") {
    return baseLog(arg.name || "anonymous")(arg);
  }

  return <T extends AnyFn>(fn: T) => baseLog(arg)(fn);
}

export const requireRole = (role: Role) => {
  return createDecorator<AnyFn>((next) => {
    if (getRole() !== role) {
      throw new PermissionError(role);
    }
    return next();
  });
};
