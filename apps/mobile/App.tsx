import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";

import { createBackend } from "goalgrid-backend/index";
import { trainedModelMeta } from "goalgrid-core/model/trainedPriors";
import type { Goal, Schedule, UserProfile } from "goalgrid-core/types";
import { AsyncStorageKV } from "./src/AsyncStorageKV";

// The mobile app talks to the SAME backend as the web app, in-process, against
// an AsyncStorage device store. This screen is a Phase-1 smoke test: it proves
// the engine + backend + trained model run on-device before we port any UI.
const backend = createBackend(new AsyncStorageKV());

function hm(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  const ap = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ap}`;
}

const DEMO_PROFILE: UserProfile = {
  occupation: "student",
  age: 20,
  sleepHours: 8,
  wakeTime: 7 * 60,
  maxPlanningHoursPerDay: 8,
  activityLevel: "moderate",
  commitments: [
    { id: "college", label: "College", kind: "school", start: 9 * 60, end: 15 * 60, daysOfWeek: [1, 2, 3, 4, 5] },
  ],
};

const DEMO_GOALS: Goal[] = [
  { id: "study", title: "Study", category: ["study", "exams"], estimatedMinutes: 120, timePreference: "morning", recurrence: { kind: "weekdays" } },
  { id: "gym", title: "Gym", category: ["health", "gym"], estimatedMinutes: 60, timePreference: "afternoon", recurrence: { kind: "daily" } },
  { id: "football", title: "Football", category: ["sports", "football"], estimatedMinutes: 90, timePreference: "evening", recurrence: { kind: "weekly", daysOfWeek: [1, 3, 5] } },
];

export default function App() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<Schedule | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      await backend.client.put("/profile", DEMO_PROFILE);
      for (const g of DEMO_GOALS) await backend.client.post("/goals", g);
      const today = new Date().toISOString().slice(0, 10);
      const res = await backend.client.post("/schedule/plan", { horizon: "weekly", from: today });
      if (res.status >= 400) throw new Error((res.body as any)?.error ?? "plan failed");
      setSchedule((res.body as any).schedule as Schedule);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function reset() {
    await backend.client.del("/data");
    await run();
  }

  useEffect(() => {
    run();
  }, []);

  const day = schedule?.days[0];

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.h1}>GoalGrid</Text>
        <Text style={styles.sub}>
          Phase-1 smoke test · engine + backend + trained model on-device
        </Text>
        <Text style={styles.meta}>
          model v{trainedModelMeta.version} · trained on {trainedModelMeta.trainedOn.toLocaleString()} users
        </Text>

        {loading && <ActivityIndicator color="#fff" style={{ marginTop: 32 }} />}
        {error && <Text style={styles.error}>⚠️ {error}</Text>}

        {day && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Today's Plan ({day.date})</Text>
            {day.blocks.length === 0 && <Text style={styles.sub}>Nothing scheduled.</Text>}
            {day.blocks.map((b, i) => (
              <View key={i} style={styles.row}>
                <Text style={styles.time}>{hm(b.start)}</Text>
                <Text style={styles.title}>{b.title}</Text>
                <Text style={styles.prio}>P{b.priorityLevel}</Text>
              </View>
            ))}
            <Text style={styles.footer}>
              {(day.usedMinutes / 60).toFixed(1)}h planned of {(day.capacityMinutes / 60).toFixed(1)}h free
            </Text>
          </View>
        )}

        <Pressable style={styles.btn} onPress={reset}>
          <Text style={styles.btnText}>Reset & re-plan</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#000" },
  content: { padding: 20 },
  h1: { color: "#fff", fontSize: 28, fontWeight: "700" },
  sub: { color: "#9a9a9a", fontSize: 14, marginTop: 4 },
  meta: { color: "#6a6a6a", fontSize: 12, marginTop: 8 },
  card: { backgroundColor: "#141414", borderColor: "#2a2a2a", borderWidth: 1, borderRadius: 16, padding: 16, marginTop: 20 },
  cardTitle: { color: "#fff", fontSize: 13, marginBottom: 8 },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomColor: "#2a2a2a", borderBottomWidth: 1 },
  time: { color: "#9a9a9a", width: 84, fontSize: 13 },
  title: { color: "#fff", flex: 1, fontSize: 15, fontWeight: "500" },
  prio: { color: "#9a9a9a", fontSize: 13 },
  footer: { color: "#6a6a6a", fontSize: 12, marginTop: 12 },
  error: { color: "#ff453a", marginTop: 24 },
  btn: { backgroundColor: "#fff", borderRadius: 14, padding: 15, marginTop: 24, alignItems: "center" },
  btnText: { color: "#000", fontWeight: "600", fontSize: 15 },
});
