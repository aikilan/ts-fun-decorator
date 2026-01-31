import { h } from "./h";

export const calls: string[] = [];

export const deco = <T extends (...args: any[]) => any>(fn: T): T => {
  return function (this: unknown, ...args: any[]) {
    calls.push("D");
    const result = fn.apply(this, args);
    if (result && Array.isArray(result.children)) {
      return result.children.join("");
    }
    return result;
  } as T;
};

export const earlyResult = hello({ name: "X" });
export const jsxAt = <div>@decorator</div>;

@deco
export function hello(props: { name: string }) {
  return <div>hi:{props.name}</div>;
}

export const rendered = hello({ name: "Y" });
export const tag = h("div", null, "ok").tag;
