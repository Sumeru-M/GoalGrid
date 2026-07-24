import { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useApp } from "../appContext";
import { useTheme, priorityLabel } from "../theme";
import { H1, Screen, Sub } from "../components/ui";
import { api } from "../lib/api";
import { todayISO } from "../lib/format";
import type { Goal, PriorityLevel } from "goalgrid-core/types";

export function Priority() {
  const t = useTheme();
  const { data } = useApp();
  const [ordered, setOrdered] = useState<Goal[]>([]);
  const [levels, setLevels] = useState<Record<string, PriorityLevel>>({});
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  function flash(msg: string) {
    setNotice(msg);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setNotice(null), 2500);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const today = todayISO();
        const scored = await Promise.all(data.goals.map(async (g) => ({ g, ex: await api.explainGoal(g.id, today) })));
        if (cancelled) return;
        scored.sort((a, b) => b.ex.score - a.ex.score);
        setOrdered(scored.map((s) => s.g));
        setLevels(Object.fromEntries(scored.map((s) => [s.g.id, s.ex.priorityLevel])));
      } catch (e) {
        if (!cancelled) flash(e instanceof Error ? e.message : "Couldn't load priorities.");
      }
    })();
    return () => { cancelled = true; };
  }, [data.goals]);

  async function commit(next: Goal[]) {
    setOrdered(next);
    setBusy(true);
    try {
      const newLevels: Record<string, PriorityLevel> = {};
      for (let i = 0; i < next.length; i++) {
        const level = Math.min(5, i + 1) as PriorityLevel;
        newLevels[next[i].id] = level;
        if (next[i].declaredPriority !== level) await api.updateGoal({ ...next[i], declaredPriority: level });
      }
      setLevels(newLevels);
      await data.reload();
    } catch (e) {
      flash(e instanceof Error ? e.message : "Couldn't update priorities.");
    } finally { setBusy(false); }
  }

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= ordered.length) return;
    const copy = [...ordered];
    [copy[i], copy[j]] = [copy[j], copy[i]];
    commit(copy);
  }

  return (
    <Screen>
      <View style={{ paddingTop: 8 }}><H1>Priority</H1></View>
      <Sub style={{ marginBottom: 16 }}>
        Reorder — the planner schedules higher-priority tasks first, and learns your preference across each category.
      </Sub>

      {ordered.length === 0 && <Sub style={{ textAlign: "center", marginTop: 30 }}>Add goals to set priorities.</Sub>}

      {ordered.map((g, i) => (
        <View key={g.id} style={{ flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: t.card, borderColor: t.stroke, borderWidth: 1, borderRadius: t.radiusSm, padding: 14, marginBottom: 12, minHeight: 64 }}>
          <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: t.accent, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: t.onAccent, fontWeight: "700" }}>{i + 1}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: t.text, fontWeight: "600" }}>{g.title}</Text>
            <Text style={{ color: t.muted, fontSize: 12, marginTop: 2 }}>{priorityLabel(levels[g.id] ?? 3)}</Text>
          </View>
          <View style={{ gap: 4 }}>
            <Pressable disabled={busy || i === 0} onPress={() => move(i, -1)} style={{ backgroundColor: t.card, borderColor: t.stroke, borderWidth: 1, borderRadius: 8, width: 34, height: 26, alignItems: "center", justifyContent: "center", opacity: i === 0 ? 0.35 : 1 }}>
              <Text style={{ color: t.muted, fontSize: 11 }}>▲</Text>
            </Pressable>
            <Pressable disabled={busy || i === ordered.length - 1} onPress={() => move(i, 1)} style={{ backgroundColor: t.card, borderColor: t.stroke, borderWidth: 1, borderRadius: 8, width: 34, height: 26, alignItems: "center", justifyContent: "center", opacity: i === ordered.length - 1 ? 0.35 : 1 }}>
              <Text style={{ color: t.muted, fontSize: 11 }}>▼</Text>
            </Pressable>
          </View>
        </View>
      ))}

      {notice && <Sub style={{ color: t.danger, textAlign: "center", marginTop: 4 }}>{notice}</Sub>}
    </Screen>
  );
}
