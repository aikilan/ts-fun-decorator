import { useEffect, useMemo, useState } from "react";
import "./App.css";
import type { TodoItem } from "./types";
import {
  PermissionError,
  getRole,
  setRole,
  type Role
} from "./decorators";
import {
  addTodo,
  clearCompleted,
  removeTodo,
  toggleTodo
} from "./logic";
import { runDecoratorTests } from "./decorator-tests";

const roleLabels: Record<Role, string> = {
  user: "普通用户",
  admin: "管理员"
};

type TestResult = Awaited<ReturnType<typeof runDecoratorTests>>;

function App() {
  const [role, setRoleState] = useState<Role>(getRole());
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState<string>("");
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  useEffect(() => {
    setRole(role);
  }, [role]);

  useEffect(() => {
    runDecoratorTests()
      .then(setTestResult)
      .catch((err) => {
        console.error("decorator tests failed", err);
      });
  }, []);

  const remaining = useMemo(
    () => todos.filter((item) => !item.done).length,
    [todos]
  );

  const onAdd = () => {
    setTodos((prev) => addTodo(prev, text));
    setText("");
  };

  const onToggle = (id: string) => {
    setTodos((prev) => toggleTodo(prev, id));
  };

  const onRemove = (id: string) => {
    setTodos((prev) => removeTodo(prev, id));
  };

  const onClear = () => {
    try {
      setTodos((prev) => clearCompleted(prev));
      setError("");
    } catch (err) {
      if (err instanceof PermissionError) {
        setError(err.message);
        return;
      }
      throw err;
    }
  };

  return (
    <div className="page">
      <header className="header">
        <div>
          <p className="eyebrow">Function Decorator Demo</p>
          <h1>待办事项</h1>
          <p className="subtitle">
            装饰器用于日志追踪与权限拦截（清理已完成需要管理员权限）
          </p>
        </div>
        <div className="role-switch">
          <span>当前角色</span>
          <div className="role-buttons">
            {(Object.keys(roleLabels) as Role[]).map((key) => (
              <button
                key={key}
                type="button"
                className={role === key ? "active" : ""}
                onClick={() => setRoleState(key)}
              >
                {roleLabels[key]}
              </button>
            ))}
          </div>
        </div>
      </header>

      <section className="panel">
        <div className="input-row">
          <input
            value={text}
            placeholder="写点什么..."
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                onAdd();
              }
            }}
          />
          <button type="button" onClick={onAdd}>
            添加
          </button>
        </div>

        {error ? <div className="error">{error}</div> : null}

        <ul className="list">
          {todos.length === 0 ? (
            <li className="empty">还没有任务，先加一个。</li>
          ) : (
            todos.map((item) => (
              <li key={item.id} className={item.done ? "done" : ""}>
                <label>
                  <input
                    type="checkbox"
                    checked={item.done}
                    onChange={() => onToggle(item.id)}
                  />
                  <span>{item.text}</span>
                </label>
                <div className="actions">
                  <button type="button" onClick={() => onRemove(item.id)}>
                    删除
                  </button>
                </div>
              </li>
            ))
          )}
        </ul>

        <footer className="footer">
          <span>剩余 {remaining} 项</span>
          <button type="button" onClick={onClear}>
            清理已完成
          </button>
        </footer>
      </section>

      <section className="panel tests">
        <h2>装饰器测试</h2>
        <div className="test-grid">
          <div>
            <span>withArgs</span>
            <strong>{testResult?.withArgsResult ?? "..."}</strong>
          </div>
          <div>
            <span>mapReturn</span>
            <strong>{testResult?.returnResult ?? "..."}</strong>
          </div>
          <div>
            <span>async next()</span>
            <strong>{testResult?.asyncResult ?? "..."}</strong>
          </div>
          <div>
            <span>mapReturnAsync</span>
            <strong>{testResult?.asyncReturnResult ?? "..."}</strong>
          </div>
          <div>
            <span>withThis</span>
            <strong>{testResult?.withThisResult ?? "..."}</strong>
          </div>
        </div>
      </section>
    </div>
  );
}

export default App;
