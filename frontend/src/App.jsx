import { useEffect, useState } from "react";

const API_URL = "http://localhost:8000";

async function request(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.status === 204 ? null : res.json();
}

function App() {
  const [todos, setTodos] = useState([]);
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const [dragIndex, setDragIndex] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");

  useEffect(() => {
    request("/todos")
      .then(setTodos)
      .catch(() => setError("Could not reach the server."));
  }, []);

  async function addTodo(e) {
    e.preventDefault();
    if (!title.trim()) return;
    try {
      const newTodo = await request("/todos", {
        method: "POST",
        body: JSON.stringify({ title: title.trim() }),
      });
      setTodos([...todos, newTodo]);
      setTitle("");
    } catch {
      setError("Could not add the to-do.");
    }
  }

  async function updateTodo(id, changes) {
    const updated = await request(`/todos/${id}`, {
      method: "PATCH",
      body: JSON.stringify(changes),
    });
    setTodos((current) => current.map((t) => (t.id === id ? updated : t)));
  }

  async function toggleTodo(todo) {
    try {
      await updateTodo(todo.id, { completed: !todo.completed });
    } catch {
      setError("Could not update the to-do.");
    }
  }

  function startEditing(todo) {
    setEditingId(todo.id);
    setEditText(todo.title);
  }

  function cancelEditing() {
    setEditingId(null);
    setEditText("");
  }

  async function saveEdit(todo) {
    const newTitle = editText.trim();
    cancelEditing();
    if (!newTitle || newTitle === todo.title) return;
    try {
      await updateTodo(todo.id, { title: newTitle });
    } catch {
      setError("Could not rename the to-do.");
    }
  }

  async function deleteTodo(id) {
    try {
      await request(`/todos/${id}`, { method: "DELETE" });
      setTodos(todos.filter((t) => t.id !== id));
    } catch {
      setError("Could not delete the to-do.");
    }
  }

  async function saveOrder(newTodos) {
    const previous = todos;
    setTodos(newTodos);
    try {
      await request("/todos/order", {
        method: "PUT",
        body: JSON.stringify({ ids: newTodos.map((t) => t.id) }),
      });
    } catch {
      setTodos(previous);
      setError("Could not save the new order.");
    }
  }

  function moveTodo(fromIndex, toIndex) {
    if (fromIndex === null || fromIndex === toIndex) return;
    if (toIndex < 0 || toIndex >= todos.length) return;
    const updated = [...todos];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    saveOrder(updated);
  }

  return (
    <main className="app">
      <h1>To-Do</h1>
      {error && <p className="error">{error}</p>}

      <form onSubmit={addTodo}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What needs doing?"
          maxLength={200}
        />
        <button type="submit">Add</button>
      </form>

      <ul>
        {todos.map((todo, index) => {
          const isEditing = editingId === todo.id;
          return (
            <li
              key={todo.id}
              draggable={!isEditing}
              onDragStart={() => setDragIndex(index)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                moveTodo(dragIndex, index);
                setDragIndex(null);
              }}
              onDragEnd={() => setDragIndex(null)}
              className={dragIndex === index ? "dragging" : ""}
            >
              <div className="left">
                <span className="handle">⠿</span>
                <span className="num">{index + 1}.</span>
                <input
                  type="checkbox"
                  checked={todo.completed}
                  onChange={() => toggleTodo(todo)}
                />
                {isEditing ? (
                  <input
                    className="edit-input"
                    value={editText}
                    autoFocus
                    maxLength={200}
                    onChange={(e) => setEditText(e.target.value)}
                    onBlur={() => saveEdit(todo)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.currentTarget.blur();
                      if (e.key === "Escape") cancelEditing();
                    }}
                  />
                ) : (
                  <span
                    className={todo.completed ? "title done" : "title"}
                    onDoubleClick={() => startEditing(todo)}
                    title="Double-click to edit"
                  >
                    {todo.title}
                  </span>
                )}
              </div>
              <div className="actions">
                <button onClick={() => moveTodo(index, index - 1)} disabled={index === 0}>
                  ↑
                </button>
                <button
                  onClick={() => moveTodo(index, index + 1)}
                  disabled={index === todos.length - 1}
                >
                  ↓
                </button>
                <button onClick={() => startEditing(todo)} disabled={isEditing}>
                  Edit
                </button>
                <button onClick={() => deleteTodo(todo.id)}>Delete</button>
              </div>
            </li>
          );
        })}
      </ul>

      {todos.length === 0 && !error && (
        <p className="empty">Nothing yet. Add your first to-do above.</p>
      )}
    </main>
  );
}

export default App;