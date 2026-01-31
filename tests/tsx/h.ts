export function h(tag: string, props: any, ...children: any[]) {
  return { tag, props: props ?? null, children };
}
