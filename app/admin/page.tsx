"use client";
import { useState, useEffect, useCallback } from "react";

type User = {
  id: string;
  username: string;
  email: string | null;
  role: string;
  mustResetPassword: boolean;
  createdAt: string;
  _count: { workoutLogs: number };
};

const ROLES = ["user", "trainer", "admin"];

export default function AdminPage() {
  const [key, setKey] = useState("");
  const [authed, setAuthed] = useState(false);
  const [authError, setAuthError] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchUsers = useCallback(async (secret: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin", {
        headers: { "x-admin-key": secret },
      });
      if (res.status === 401) {
        setAuthed(false);
        setAuthError("Wrong key.");
        return;
      }
      const data = await res.json();
      setUsers(data.users);
      setAuthed(true);
    } catch {
      setError("Failed to load users.");
    } finally {
      setLoading(false);
    }
  }, []);

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    fetchUsers(key);
  }

  async function deleteUser(userId: string, username: string) {
    if (!confirm(`Delete @${username} and all their data? This cannot be undone.`)) return;
    setDeletingId(userId);
    try {
      await fetch("/api/admin", {
        method: "DELETE",
        headers: { "x-admin-key": key, "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      setUsers(u => u.filter(x => x.id !== userId));
    } catch {
      setError("Delete failed.");
    } finally {
      setDeletingId(null);
    }
  }

  async function updateRole(userId: string, role: string) {
    setUpdatingId(userId);
    try {
      const res = await fetch("/api/admin", {
        method: "PATCH",
        headers: { "x-admin-key": key, "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role }),
      });
      const data = await res.json();
      if (data.user) {
        setUsers(u => u.map(x => x.id === userId ? { ...x, role: data.user.role } : x));
      }
    } catch {
      setError("Role update failed.");
    } finally {
      setUpdatingId(null);
    }
  }

  function badgeStyle(role: string): React.CSSProperties {
    return {
      display: "inline-block",
      padding: "2px 10px",
      borderRadius: 20,
      fontSize: 11,
      fontWeight: 700,
      background: role === "admin" ? "#2a1a4a" : role === "trainer" ? "#1a2a1a" : "#1a1a1a",
      color: role === "admin" ? "#a29bfe" : role === "trainer" ? "#55efc4" : "#888",
      border: `1px solid ${role === "admin" ? "#4a2a8a" : role === "trainer" ? "#2a5a2a" : "#333"}`,
    };
  }

  const s: Record<string, React.CSSProperties> = {
    page: {
      minHeight: "100vh",
      background: "#0a0a0a",
      color: "#f0f0f0",
      fontFamily: "'Inter', sans-serif",
      padding: "40px 20px",
    },
    card: {
      maxWidth: 900,
      margin: "0 auto",
    },
    heading: {
      fontSize: 28,
      fontWeight: 700,
      marginBottom: 8,
      letterSpacing: -0.5,
    },
    sub: {
      color: "#666",
      fontSize: 14,
      marginBottom: 40,
    },
    loginBox: {
      maxWidth: 360,
      margin: "80px auto",
      textAlign: "center",
    },
    input: {
      width: "100%",
      padding: "12px 16px",
      borderRadius: 10,
      border: "1px solid #333",
      background: "#1a1a1a",
      color: "#f0f0f0",
      fontSize: 15,
      marginBottom: 12,
      boxSizing: "border-box",
    },
    btn: {
      width: "100%",
      padding: "12px",
      borderRadius: 10,
      border: "none",
      background: "#fff",
      color: "#000",
      fontWeight: 700,
      fontSize: 15,
      cursor: "pointer",
    },
    table: {
      width: "100%",
      borderCollapse: "collapse" as const,
    },
    th: {
      textAlign: "left" as const,
      padding: "10px 14px",
      fontSize: 11,
      fontWeight: 600,
      color: "#555",
      textTransform: "uppercase" as const,
      letterSpacing: 0.8,
      borderBottom: "1px solid #1f1f1f",
    },
    td: {
      padding: "12px 14px",
      fontSize: 14,
      borderBottom: "1px solid #141414",
      verticalAlign: "middle" as const,
    },
    deleteBtn: {
      padding: "5px 12px",
      borderRadius: 7,
      border: "1px solid #3a1a1a",
      background: "#1a0a0a",
      color: "#ff6b6b",
      fontSize: 12,
      fontWeight: 600,
      cursor: "pointer",
    },
    select: {
      padding: "5px 10px",
      borderRadius: 7,
      border: "1px solid #2a2a2a",
      background: "#1a1a1a",
      color: "#f0f0f0",
      fontSize: 13,
      cursor: "pointer",
    },
    errMsg: {
      color: "#ff6b6b",
      fontSize: 13,
      marginBottom: 16,
      textAlign: "center" as const,
    },
    stats: {
      display: "flex",
      gap: 24,
      marginBottom: 32,
    },
    statBox: {
      padding: "16px 24px",
      borderRadius: 12,
      background: "#111",
      border: "1px solid #1f1f1f",
    },
    statNum: {
      fontSize: 28,
      fontWeight: 700,
    },
    statLabel: {
      fontSize: 12,
      color: "#555",
      marginTop: 2,
    },
  };

  if (!authed) {
    return (
      <div style={s.page}>
        <div style={s.loginBox}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🔐</div>
          <div style={{ ...s.heading, marginBottom: 24 }}>Admin</div>
          <form onSubmit={handleLogin}>
            <input
              style={s.input}
              type="password"
              placeholder="Admin key"
              value={key}
              onChange={e => setKey(e.target.value)}
              autoFocus
            />
            {authError && <div style={s.errMsg}>{authError}</div>}
            <button style={s.btn} type="submit">Enter</button>
          </form>
        </div>
      </div>
    );
  }

  const totalLogs = users.reduce((n, u) => n + u._count.workoutLogs, 0);

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.heading}>Admin Panel</div>
        <div style={s.sub}>Ironlog — developer access only</div>

        <div style={s.stats}>
          <div style={s.statBox}>
            <div style={s.statNum}>{users.length}</div>
            <div style={s.statLabel}>Total users</div>
          </div>
          <div style={s.statBox}>
            <div style={s.statNum}>{totalLogs}</div>
            <div style={s.statLabel}>Workout logs</div>
          </div>
          <div style={s.statBox}>
            <div style={s.statNum}>{users.filter(u => u.role === "trainer").length}</div>
            <div style={s.statLabel}>Trainers</div>
          </div>
        </div>

        {error && <div style={s.errMsg}>{error}</div>}
        {loading ? (
          <div style={{ color: "#555", textAlign: "center", padding: 60 }}>Loading...</div>
        ) : (
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Username</th>
                <th style={s.th}>Email</th>
                <th style={s.th}>Role</th>
                <th style={s.th}>Logs</th>
                <th style={s.th}>Joined</th>
                <th style={s.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id}>
                  <td style={s.td}>
                    <span style={{ fontWeight: 600 }}>@{u.username}</span>
                    {u.mustResetPassword && (
                      <span style={{ marginLeft: 8, fontSize: 11, color: "#fdcb6e" }}>must reset</span>
                    )}
                  </td>
                  <td style={{ ...s.td, color: "#666" }}>{u.email ?? "—"}</td>
                  <td style={s.td}>
                    <span style={badgeStyle(u.role)}>{u.role}</span>
                  </td>
                  <td style={{ ...s.td, color: "#888" }}>{u._count.workoutLogs}</td>
                  <td style={{ ...s.td, color: "#555" }}>
                    {new Date(u.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </td>
                  <td style={s.td}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <select
                        style={s.select}
                        value={u.role}
                        disabled={updatingId === u.id}
                        onChange={e => updateRole(u.id, e.target.value)}
                      >
                        {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                      <button
                        style={s.deleteBtn}
                        onClick={() => deleteUser(u.id, u.username)}
                        disabled={deletingId === u.id}
                      >
                        {deletingId === u.id ? "..." : "Delete"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
