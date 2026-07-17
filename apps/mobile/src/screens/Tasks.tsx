import { useState } from "react";
import { Text, View } from "react-native";
import { useApp } from "../appContext";
import { useTheme, priorityColor } from "../theme";
import { Btn, Card, Dot, H1, Screen, Sub } from "../components/ui";
import { api } from "../lib/api";
import { dur, todayISO } from "../lib/format";

export function Tasks() {
  const t = useTheme();
  const { data, openAdd } = useApp();
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const done = data.completedTodayByGoal;

  const levelOf: Record<string, number> = {};
  for (const d of data.schedule?.days ?? []) for (const b of d.blocks) levelOf[b.goalId] = b.priorityLevel;

  function flash(msg: string) {
    setNotice(msg);
    setTimeout(() => setNotice(null), 2500);
  }

  async function markDone(id: string) {
    setBusy(id);
    try { await api.recordOutcome(id, true, todayISO()); await data.reload(); }
    catch (e) { flash(e instanceof Error ? e.message : "Couldn't save. Try again."); }
    finally { setBusy(null); }
  }
  async function remove(id: string) {
    setBusy(id);
    try { await api.deleteGoal(id); await data.reload(); }
    catch (e) { flash(e instanceof Error ? e.message : "Couldn't delete. Try again."); }
    finally { setBusy(null); }
  }

  return (
    <Screen>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 8 }}>
        <H1>Tasks</H1>
      </View>

      {data.goals.length === 0 && <Sub style={{ textAlign: "center", marginTop: 40 }}>No goals yet. Tap the + to create one.</Sub>}

      {data.goals.map((g) => (
        <Card key={g.id}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Dot color={priorityColor(t, levelOf[g.id] ?? 3)} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.text, fontWeight: "600" }}>{g.title}</Text>
              <Text style={{ color: t.muted, fontSize: 12, marginTop: 2 }}>
                {g.category.join(" › ")} · {dur(g.estimatedMinutes)}{g.timePreference ? ` · ${g.timePreference}` : ""}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Btn label={done[g.id] ? "✓ Done today" : "Mark as Done"} disabled={busy === g.id || done[g.id]} onPress={() => markDone(g.id)} />
            </View>
            <View style={{ flex: 1 }}>
              <Btn label="Delete" ghost disabled={busy === g.id} onPress={() => remove(g.id)} />
            </View>
          </View>
        </Card>
      ))}

      {notice && <Sub style={{ color: t.danger, textAlign: "center", marginTop: 12 }}>{notice}</Sub>}

      <Btn label="+ Add goal" onPress={openAdd} />
    </Screen>
  );
}
