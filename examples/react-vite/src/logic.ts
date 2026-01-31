import { log, requireRole } from "./decorators";
import type { TodoItem } from "./types";

void log;
void requireRole;

const makeId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `t_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
};

@log("addTodo")
export function addTodo(list: TodoItem[], text: string): TodoItem[] {
  const trimmed = text.trim();
  if (!trimmed) return list;
  const next: TodoItem = {
    id: makeId(),
    text: trimmed,
    done: false,
    createdAt: Date.now()
  };
  return [next, ...list];
}

@log("toggleTodo")
export function toggleTodo(list: TodoItem[], id: string): TodoItem[] {
  return list.map((item) =>
    item.id === id ? { ...item, done: !item.done } : item
  );
}

@log("removeTodo")
export function removeTodo(list: TodoItem[], id: string): TodoItem[] {
  return list.filter((item) => item.id !== id);
}

@log("clearCompleted")
@requireRole("admin")
export function clearCompleted(list: TodoItem[]): TodoItem[] {
  return list.filter((item) => !item.done);
}
