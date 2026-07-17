import { useState } from "react";
import { useAppData } from "./lib/useAppData";
import { Setup } from "./screens/Setup";
import { Dashboard } from "./screens/Dashboard";
import { Calendar } from "./screens/Calendar";
import { Priority } from "./screens/Priority";
import { Tasks } from "./screens/Tasks";
import { Reschedule } from "./screens/Reschedule";
import { AddGoal } from "./screens/AddGoal";

export type Tab = "home" | "calendar" | "tasks" | "priority" | "reschedule" | "add";

function StatusBar() {
  return (
    <div className="statusbar">
      <span>9:41</span>
      <span>▪ ▪ ▪ ▪ 🔋</span>
    </div>
  );
}

function BottomNav({ tab, go }: { tab: Tab; go: (t: Tab) => void }) {
  const item = (id: Tab, icon: string, label: string) => (
    <button className={`nav-item ${tab === id ? "active" : ""}`} onClick={() => go(id)}>
      <span className="nav-icon">{icon}</span>
      {label}
    </button>
  );
  return (
    <nav className="bottom-nav">
      {item("home", "▦", "Home")}
      {item("calendar", "◷", "Calendar")}
      <button className="fab" onClick={() => go("add")} aria-label="Add goal">+</button>
      {item("tasks", "☑", "Tasks")}
      {item("priority", "⚑", "Priority")}
    </nav>
  );
}

export default function App() {
  const data = useAppData();
  const [tab, setTab] = useState<Tab>("home");

  if (data.loading) {
    return (
      <div className="app-frame">
        <StatusBar />
        <div className="empty">Loading your planner…</div>
      </div>
    );
  }

  if (data.error) {
    return (
      <div className="app-frame">
        <StatusBar />
        <div className="screen">
          <div className="empty" style={{ paddingTop: 80 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
            <div style={{ color: "var(--text)", fontWeight: 600, marginBottom: 6 }}>Couldn't load your data</div>
            <div style={{ marginBottom: 20 }}>{data.error}</div>
            <button className="btn" onClick={() => data.reload()}>Try Again</button>
          </div>
        </div>
      </div>
    );
  }

  // Onboarding gate: no profile → run the 4-step setup wizard.
  if (!data.profile) {
    return (
      <div className="app-frame">
        <StatusBar />
        <Setup onDone={async () => { await data.reload(); setTab("home"); }} />
      </div>
    );
  }

  const screen = () => {
    switch (tab) {
      case "home": return <Dashboard data={data} go={setTab} />;
      case "calendar": return <Calendar data={data} />;
      case "priority": return <Priority data={data} />;
      case "tasks": return <Tasks data={data} go={setTab} />;
      case "reschedule": return <Reschedule data={data} back={() => setTab("home")} />;
      case "add": return <AddGoal data={data} back={() => setTab("tasks")} />;
    }
  };

  return (
    <div className="app-frame">
      <StatusBar />
      {screen()}
      <BottomNav tab={tab} go={setTab} />
    </div>
  );
}
