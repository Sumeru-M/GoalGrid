import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Slider from "@react-native-community/slider";
import { useTheme } from "../theme";
import { Btn, FieldLabel, Segmented, Sub } from "../components/ui";
import { api } from "../lib/api";
import type { ActivityLevel, CommitmentBlock, Goal, Occupation, PriorityLevel, TimeOfDay, UserProfile } from "goalgrid-core/types";

interface Activity { key: string; name: string; icon: string; category: string[]; on: boolean; hours: number; time: TimeOfDay; }
const DEFAULT_ACTIVITIES: Activity[] = [
  { key: "study", name: "Study", icon: "📘", category: ["study", "exams"], on: true, hours: 3, time: "morning" },
  { key: "gym", name: "Gym", icon: "🏋️", category: ["health", "gym"], on: true, hours: 1, time: "afternoon" },
  { key: "football", name: "Football", icon: "⚽", category: ["sports", "football"], on: true, hours: 1.5, time: "evening" },
  { key: "reading", name: "Hobbies", icon: "🎨", category: ["hobbies", "reading"], on: false, hours: 0.5, time: "night" },
];
const OCCUPATIONS = ["student", "professional", "self-employed", "unemployed", "retired", "other"].map((o) => ({ value: o as Occupation, label: o }));
const TIMES = ["morning", "afternoon", "evening", "night"].map((x) => ({ value: x as TimeOfDay, label: x[0].toUpperCase() + x.slice(1) }));
const ACTIVITY_LEVELS = ["low", "moderate", "high"].map((x) => ({ value: x as ActivityLevel, label: x[0].toUpperCase() + x.slice(1) }));

export function Setup({ onDone }: { onDone: () => void }) {
  const t = useTheme();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const [occupation, setOccupation] = useState<Occupation>("student");
  const [age, setAge] = useState("19");
  const [sleep, setSleep] = useState(8);
  const [commit, setCommit] = useState(6);
  const [activity, setActivity] = useState<ActivityLevel>("moderate");
  const [hoursPerDay, setHoursPerDay] = useState(8);
  const [activities, setActivities] = useState(DEFAULT_ACTIVITIES);
  const [order, setOrder] = useState<string[]>(activities.filter((a) => a.on).map((a) => a.key));

  const steps = ["About you", "Daily time", "Activities", "Priorities"];
  const setAct = (key: string, patch: Partial<Activity>) => setActivities((p) => p.map((a) => (a.key === key ? { ...a, ...patch } : a)));

  function moveOrder(key: string, dir: -1 | 1) {
    setOrder((prev) => {
      const i = prev.indexOf(key), j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const c = [...prev]; [c[i], c[j]] = [c[j], c[i]]; return c;
    });
  }

  async function finish() {
    setSaving(true);
    try {
      const commitments: CommitmentBlock[] = commit > 0 ? [{
        id: "commit", label: occupation === "student" ? "College" : "Work",
        kind: occupation === "student" ? "school" : "work", start: 9 * 60, end: 9 * 60 + Math.round(commit * 60), daysOfWeek: [1, 2, 3, 4, 5],
      }] : [];
      const profile: UserProfile = {
        occupation, age: Number(age) || 18, sleepHours: sleep, commitments,
        maxPlanningHoursPerDay: hoursPerDay, wakeTime: 7 * 60, activityLevel: activity,
      };
      await api.saveProfile(profile);
      for (const a of activities.filter((x) => x.on)) {
        const goal: Goal = { id: a.key, title: a.name, category: a.category, estimatedMinutes: Math.round(a.hours * 60), timePreference: a.time, recurrence: a.key === "study" ? { kind: "weekdays" } : { kind: "daily" } };
        await api.createGoal(goal);
      }
      const ordered = order.map((k) => activities.find((a) => a.key === k)).filter((a): a is Activity => !!a);
      for (let i = 0; i < ordered.length; i++) await api.declarePriority(ordered[i].category, Math.min(5, i + 1) as PriorityLevel);
      onDone();
    } finally { setSaving(false); }
  }

  const input = { backgroundColor: t.dark ? "#1e1e1e" : "#f2f2f5", borderColor: t.stroke, borderWidth: 1, color: t.text, borderRadius: t.radiusSm, padding: 13, fontSize: 16 };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }} edges={["top", "bottom"]}>
      <View style={{ flex: 1, padding: 20 }}>
        <Text style={{ color: t.text, fontSize: 24, fontWeight: t.titleWeight }}>AI Planner Setup</Text>
        <Text style={{ color: t.muted, fontSize: 12, marginTop: 12 }}>Step {step + 1} of 4 · {steps[step]}</Text>
        <View style={{ height: 4, backgroundColor: t.stroke, borderRadius: 4, marginTop: 6, marginBottom: 8, overflow: "hidden" }}>
          <View style={{ width: `${((step + 1) / 4) * 100}%`, height: "100%", backgroundColor: t.accent }} />
        </View>

        <View style={{ flex: 1 }}>
          {step === 0 && (
            <View>
              <Text style={{ color: t.text, fontSize: 21, fontWeight: "700", marginVertical: 12 }}>Tell us about you</Text>
              <FieldLabel>Occupation</FieldLabel>
              <Segmented options={OCCUPATIONS} value={occupation} onChange={setOccupation} />
              <FieldLabel>Age</FieldLabel>
              <TextInput value={age} onChangeText={setAge} keyboardType="number-pad" style={input} />
              <FieldLabel>Sleep per night: {sleep}h</FieldLabel>
              <Slider minimumValue={4} maximumValue={12} step={0.5} value={sleep} onValueChange={setSleep} minimumTrackTintColor={t.accent} maximumTrackTintColor={t.stroke} thumbTintColor={t.accent} />
              <FieldLabel>Daily commitments (work/school): {commit}h</FieldLabel>
              <Slider minimumValue={0} maximumValue={12} step={0.5} value={commit} onValueChange={setCommit} minimumTrackTintColor={t.accent} maximumTrackTintColor={t.stroke} thumbTintColor={t.accent} />
              <FieldLabel>How active are you?</FieldLabel>
              <Segmented options={ACTIVITY_LEVELS} value={activity} onChange={setActivity} />
              <Sub>Being very active is always an asset, never a penalty.</Sub>
            </View>
          )}

          {step === 1 && (
            <View>
              <Text style={{ color: t.text, fontSize: 21, fontWeight: "700", marginVertical: 12 }}>How many hours can you dedicate per day?</Text>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 28, marginVertical: 24 }}>
                <Pressable onPress={() => setHoursPerDay((h) => Math.max(2, h - 1))} style={{ width: 46, height: 46, borderRadius: 23, borderWidth: 1, borderColor: t.strokeStrong, alignItems: "center", justifyContent: "center" }}><Text style={{ color: t.text, fontSize: 22 }}>−</Text></Pressable>
                <Text style={{ color: t.text, fontSize: 44, fontWeight: "800" }}>{hoursPerDay}<Text style={{ fontSize: 15, color: t.muted }}>  hours</Text></Text>
                <Pressable onPress={() => setHoursPerDay((h) => Math.min(16, h + 1))} style={{ width: 46, height: 46, borderRadius: 23, borderWidth: 1, borderColor: t.strokeStrong, alignItems: "center", justifyContent: "center" }}><Text style={{ color: t.text, fontSize: 22 }}>+</Text></Pressable>
              </View>
              <Slider minimumValue={2} maximumValue={16} step={1} value={hoursPerDay} onValueChange={setHoursPerDay} minimumTrackTintColor={t.accent} maximumTrackTintColor={t.stroke} thumbTintColor={t.accent} />
            </View>
          )}

          {step === 2 && (
            <View>
              <Text style={{ color: t.text, fontSize: 21, fontWeight: "700", marginVertical: 12 }}>What are your main activities?</Text>
              {activities.map((a) => (
                <View key={a.key} style={{ opacity: a.on ? 1 : 0.5, marginBottom: 10 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: t.card, borderColor: t.stroke, borderWidth: 1, borderRadius: t.radiusSm, padding: 12 }}>
                    <Text style={{ fontSize: 18 }}>{a.icon}</Text>
                    <Text style={{ flex: 1, color: t.text, fontWeight: "500" }}>{a.name}</Text>
                    <TextInput value={String(a.hours)} onChangeText={(v) => setAct(a.key, { hours: Number(v) || 0 })} keyboardType="decimal-pad" editable={a.on} style={{ width: 54, backgroundColor: t.dark ? "#1e1e1e" : "#f2f2f5", borderColor: t.stroke, borderWidth: 1, color: t.text, borderRadius: 9, padding: 8, textAlign: "center" }} />
                    <Text style={{ color: t.muted }}>h</Text>
                    <Pressable onPress={() => setAct(a.key, { on: !a.on })} style={{ width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: a.on ? t.accent : t.strokeStrong, backgroundColor: a.on ? t.accent : "transparent", alignItems: "center", justifyContent: "center" }}>
                      {a.on && <Text style={{ color: t.onAccent, fontSize: 14 }}>✓</Text>}
                    </Pressable>
                  </View>
                  {a.on && (<><Text style={{ color: t.muted, fontSize: 12, marginTop: 8 }}>{a.name} time</Text><Segmented options={TIMES} value={a.time} onChange={(v) => setAct(a.key, { time: v })} /></>)}
                </View>
              ))}
            </View>
          )}

          {step === 3 && (
            <View>
              <Text style={{ color: t.text, fontSize: 21, fontWeight: "700", marginVertical: 12 }}>Set your priorities</Text>
              <Sub style={{ marginBottom: 12 }}>Highest priority on top. The AI learns your preference per category.</Sub>
              {order.map((k, i) => {
                const a = activities.find((x) => x.key === k)!;
                return (
                  <View key={k} style={{ flexDirection: "row", alignItems: "center", gap: 14, backgroundColor: t.card, borderColor: t.stroke, borderWidth: 1, borderRadius: t.radiusSm, padding: 14, marginBottom: 12 }}>
                    <View style={{ width: 26, height: 26, borderRadius: 8, backgroundColor: t.accent, alignItems: "center", justifyContent: "center" }}><Text style={{ color: t.onAccent, fontWeight: "800" }}>{i + 1}</Text></View>
                    <Text style={{ fontSize: 16 }}>{a.icon}</Text>
                    <Text style={{ flex: 1, color: t.text, fontWeight: "600" }}>{a.name}</Text>
                    <Pressable disabled={i === 0} onPress={() => moveOrder(k, -1)} style={{ padding: 6, opacity: i === 0 ? 0.35 : 1 }}><Text style={{ color: t.muted }}>▲</Text></Pressable>
                    <Pressable disabled={i === order.length - 1} onPress={() => moveOrder(k, 1)} style={{ padding: 6, opacity: i === order.length - 1 ? 0.35 : 1 }}><Text style={{ color: t.muted }}>▼</Text></Pressable>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        <View style={{ flexDirection: "row", gap: 12 }}>
          {step > 0 && <View style={{ flex: 1 }}><Btn label="Back" ghost onPress={() => setStep(step - 1)} /></View>}
          <View style={{ flex: 1 }}>
            {step < 2 && <Btn label="Continue" onPress={() => setStep(step + 1)} />}
            {step === 2 && <Btn label="Continue" onPress={() => { setOrder(activities.filter((a) => a.on).map((a) => a.key)); setStep(3); }} />}
            {step === 3 && <Btn label={saving ? "Building…" : "Generate My Plan"} disabled={saving} onPress={finish} />}
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
