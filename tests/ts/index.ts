export const calls: string[] = [];

export const decoA = <T extends (...args: any[]) => any>(fn: T): T => {
  return function (this: unknown, ...args: any[]) {
    calls.push("A");
    return fn.apply(this, args);
  } as T;
};

export const decoB = <T extends (...args: any[]) => any>(fn: T): T => {
  return function (this: unknown, ...args: any[]) {
    calls.push("B");
    return fn.apply(this, args);
  } as T;
};

export const earlyResult = hoisted(2);
export const overloadedEarly = overloaded(5);
export const defaultResult = defaulted(7);
export const email = "a@b.com";

@decoA
@decoB
export function hoisted(x: number) {
  return x + 1;
}

export function overloaded(x: string): string;
export function overloaded(x: number): number;
@decoB
export function overloaded(x: string | number) {
  return typeof x === "number" ? x + 1 : `${x}!`;
}

@decoA
export default function defaulted(x: number) {
  return x + 10;
}

@decoA
export const arrow = (x: number) => x * 2;

export const arrowResult = arrow(3);
export const overloadedString = overloaded("ok");
