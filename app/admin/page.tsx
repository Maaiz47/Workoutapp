"use client";
import { useState, useEffect, useCallback } from "react";
import Head from "next/head";
import Image from "next/image";

type User = {
  id: string;
  username: string;
  email: string | null;
  role: string;
  mustResetPassword: boolean;
  createdAt: string;
  roleRequest: string | null;
  _count: { workoutLogs: number };
};

type TrainerRequest = {
  id: string;
  username: string;
  email: string | null;
  note: string | null;
  requestedAt: string | null;
  workoutLogs: number;
};

const ROLES = ["user", "trainer", "admin"];

export default function AdminPage() {
  const [key, setKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [authError, setAuthError] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [trainerRequests, setTrainerRequests] = useState<TrainerRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [userSearch, setUserSearch] = useState("");

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
      setTrainerRequests(data.trainerRequests ?? []);
      setAuthed(true);
    } catch {
      setError("Failed to load users.");
    } finally {
      setLoading(false);
    }
  }, []);

  async function reviewRequest(userId: string, action: "approve-request" | "reject-request") {
    setReviewingId(userId);
    try {
      const res = await fetch("/api/admin", {
        method: "PATCH",
        headers: { "x-admin-key": key, "Content-Type": "application/json" },
        body: JSON.stringify({ userId, action }),
      });
      const data = await res.json();
      if (data.user) {
        setTrainerRequests(rs => rs.filter(r => r.id !== userId));
        setUsers(us => us.map(u => u.id === userId ? { ...u, role: data.user.role, roleRequest: null } : u));
      }
    } catch {
      setError("Review failed.");
    } finally {
      setReviewingId(null);
    }
  }

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

  async function forceReset(userId: string, username: string) {
    if (!confirm(`Force @${username} to set a new password on their next login?`)) return;
    setUpdatingId(userId);
    try {
      const res = await fetch("/api/admin", {
        method: "PATCH",
        headers: { "x-admin-key": key, "Content-Type": "application/json" },
        body: JSON.stringify({ userId, action: "force-reset" }),
      });
      const data = await res.json();
      if (data.user) {
        setUsers(u => u.map(x => x.id === userId ? { ...x, mustResetPassword: true } : x));
        alert(`@${username} will be forced to reset password on next login.`);
      } else {
        setError(data.error || "Force-reset failed.");
      }
    } catch {
      setError("Force-reset failed.");
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
      padding: "20px 12px 40px",
    },
    tableScroll: {
      width: "100%",
      overflowX: "auto" as const,
      WebkitOverflowScrolling: "touch" as const,
      borderRadius: 12,
      border: "1px solid #1f1f1f",
      background: "#0e0e0e",
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
          <Image src="/admin-icon.svg" alt="Admin" width={88} height={88} style={{ marginBottom: 16 }} priority />
          <div style={{ ...s.heading, marginBottom: 24 }}>Admin</div>
          <form onSubmit={handleLogin}>
            <div style={{ position: "relative", marginBottom: 12 }}>
              <input
                style={{ ...s.input, marginBottom: 0, paddingRight: 46 }}
                type={showKey ? "text" : "password"}
                placeholder="Admin key"
                value={key}
                onChange={e => setKey(e.target.value)}
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowKey(v => !v)}
                aria-label={showKey ? "Hide" : "Show"}
                tabIndex={-1}
                style={{
                  position: "absolute", right: 4, top: "50%", transform: "translateY(-50%)",
                  height: 36, width: 36, background: "transparent", border: "none",
                  color: "#888", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 16, padding: 0,
                }}
              >{showKey ? "🙈" : "👁"}</button>
            </div>
            {authError && <div style={s.errMsg}>{authError}</div>}
            <button style={s.btn} type="submit">Enter</button>
          </form>
        </div>
      </div>
    );
  }

  const totalLogs = users.reduce((n, u) => n + u._count.workoutLogs, 0);
  const filteredUsers = userSearch
    ? users.filter(u =>
        u.username.toLowerCase().includes(userSearch.toLowerCase()) ||
        (u.email ?? "").toLowerCase().includes(userSearch.toLowerCase())
      )
    : users;

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 8 }}>
          <Image src="/admin-icon.svg" alt="Admin" width={48} height={48} priority />
          <div style={s.heading}>Admin Panel</div>
        </div>
        <div style={s.sub}>Ironlog — developer access only</div>

        {/* QA Dashboard shortcut */}
        <a
          href="/qa"
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "12px 16px", marginBottom: 20,
            background: "rgba(255,107,107,0.06)",
            border: "1px solid rgba(255,107,107,0.2)",
            borderRadius: 10, textDecoration: "none",
            color: "#FF6B6B",
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "'Space Mono', monospace", letterSpacing: 1 }}>
            QA DASHBOARD
          </span>
          <span style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", fontFamily: "'DM Sans', sans-serif" }}>
            View &amp; submit test reports →
          </span>
        </a>

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
          <div style={{ ...s.statBox, background: trainerRequests.length ? "#1f1a08" : "#111", border: `1px solid ${trainerRequests.length ? "#5a4218" : "#1f1f1f"}` }}>
            <div style={{ ...s.statNum, color: trainerRequests.length ? "#fdcb6e" : "#f0f0f0" }}>{trainerRequests.length}</div>
            <div style={s.statLabel}>Pending requests</div>
          </div>
        </div>

        {/* Pending trainer requests panel */}
        {trainerRequests.length > 0 && (
          <div style={{
            background: "linear-gradient(180deg, rgba(253,203,110,0.06), rgba(253,203,110,0.02))",
            border: "1px solid rgba(253,203,110,0.25)",
            borderRadius: 14,
            padding: "18px 20px 16px",
            marginBottom: 28,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <div style={{ width: 6, height: 6, borderRadius: 3, background: "#fdcb6e" }}/>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#fdcb6e", letterSpacing: 1.5, textTransform: "uppercase" }}>Trainer upgrade requests</div>
              <div style={{ marginLeft: "auto", fontSize: 11, color: "#888" }}>{trainerRequests.length} pending</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {trainerRequests.map(r => (
                <div key={r.id} style={{ background: "#0f0f12", border: "1px solid #2a2418", borderRadius: 10, padding: "14px 16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <span style={{ fontWeight: 700, fontSize: 15 }}>@{r.username}</span>
                        <span style={{ ...badgeStyle("user"), fontSize: 10 }}>user → trainer</span>
                      </div>
                      <div style={{ fontSize: 12, color: "#666" }}>{r.email ?? "no email on file"}</div>
                      <div style={{ fontSize: 11, color: "#444", marginTop: 4 }}>
                        {r.workoutLogs} workout logs · requested {r.requestedAt ? new Date(r.requestedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "—"}
                      </div>
                      {r.note && (
                        <div style={{ marginTop: 10, padding: "10px 12px", background: "#161616", borderRadius: 8, borderLeft: "2px solid #fdcb6e", fontSize: 13, color: "#bbb", fontStyle: "italic", whiteSpace: "pre-wrap" }}>
                          "{r.note}"
                        </div>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <button
                        onClick={() => reviewRequest(r.id, "approve-request")}
                        disabled={reviewingId === r.id}
                        style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #2a5a2a", background: "#0a1a0a", color: "#55efc4", fontSize: 12, fontWeight: 700, cursor: "pointer", letterSpacing: 0.5 }}
                      >{reviewingId === r.id ? "…" : "✓ Approve"}</button>
                      <button
                        onClick={() => reviewRequest(r.id, "reject-request")}
                        disabled={reviewingId === r.id}
                        style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #3a1a1a", background: "#1a0a0a", color: "#ff6b6b", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                      >Reject</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Users search bar */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#888", letterSpacing: 0.5 }}>USERS</div>
          <input
            type="text"
            placeholder="Search by username or email…"
            value={userSearch}
            onChange={e => setUserSearch(e.target.value)}
            style={{ flex: 1, padding: "8px 14px", borderRadius: 8, border: "1px solid #222", background: "#0f0f0f", color: "#f0f0f0", fontSize: 13, outline: "none" }}
          />
          {userSearch && <div style={{ fontSize: 12, color: "#555" }}>{filteredUsers.length} of {users.length}</div>}
        </div>

        {error && <div style={s.errMsg}>{error}</div>}
        {loading ? (
          <div style={{ color: "#555", textAlign: "center", padding: 60 }}>Loading...</div>
        ) : (
          <div style={s.tableScroll}>
          <table style={{ ...s.table, minWidth: 720 }}>
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
              {filteredUsers.map(u => (
                <tr key={u.id}>
                  <td style={s.td}>
                    <span style={{ fontWeight: 600 }}>@{u.username}</span>
                    {u.mustResetPassword && (
                      <span style={{ marginLeft: 8, fontSize: 11, color: "#fdcb6e" }}>must reset</span>
                    )}
                    {u.roleRequest && (
                      <span style={{ marginLeft: 8, fontSize: 10, color: "#fdcb6e", background: "rgba(253,203,110,0.1)", border: "1px solid rgba(253,203,110,0.3)", padding: "1px 6px", borderRadius: 4 }}>pending {u.roleRequest}</span>
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
                        style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #4a3a18", background: "#1f1a08", color: "#fdcb6e", fontSize: 11, cursor: updatingId === u.id ? "not-allowed" : "pointer", whiteSpace: "nowrap" }}
                        onClick={() => forceReset(u.id, u.username)}
                        disabled={updatingId === u.id || u.mustResetPassword}
                        title={u.mustResetPassword ? "Already pending reset" : "Force this user to set a new password on next login"}
                      >
                        {u.mustResetPassword ? "Reset pending" : "Force reset"}
                      </button>
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
          </div>
        )}
      </div>
    </div>
  );
}
