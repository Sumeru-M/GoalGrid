import { useState } from "react";
import { Text, TextInput, View } from "react-native";
import Slider from "@react-native-community/slider";
import { useApp } from "../appContext";
import { useTheme } from "../theme";
import { Btn, FieldLabel, Segmented, Sub } from "../components/ui";
import { api } from "../lib/api";
import type { Goal, TimeOfDay } from "goalgrid-core/types";

const TIMES = [
  { value: "morning" as TimeOfDay, label: "Morning" },
  { value: "afternoon" as TimeOfDay, label: "Afternoon" },
  { value: "evening" as TimeOfDay, label: "Evening" },
  { value: "night" as TimeOfDay, label: "Night" },
];
const REPEATS = [
  { value: "daily" as const, label: "Daily" },
  { value: "weekdays" as const, label: "Weekdays" },
  { value: "once" as const, label: "Once" },
];

export function AddGoal({ onClose }: { onClose: () => void }) {
  const t = useTheme();
  const { data } = useApp();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("study > general");
  const [hours, setHours] = useState(1);
  const [time, setTime] = useState<TimeOfDay>("morning");
  const [repeat, setRepeat] = useState<"daily" | "weekdays" | "once">("daily");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    setError(null);
    setSaving(true);
    try {
      const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 20).replace(/^-|-$/g, "");
      const goal: Goal = {
        id: `${slug || "goal"}-${Math.random().toString(36).slice(2, 7)}`,
        title: title.trim(),
        category: category.split(">").map((s) => s.trim().toLowerCase()).filter(Boolean),
        estimatedMinutes: Math.round(hours * 60),
        timePreference: time,
        recurrence: { kind: repeat } as Goal["recurrence"],
      };
      await api.createGoal(goal);
      await data.reload();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save goal");
    } finally { setSaving(false); }
  }

  const input = { backgroundColor: t.dark ? "#1e1e1e" : "#f2f2f5", borderColor: t.stroke, borderWidth: 1, color: t.text, borderRadius: t.radiusSm, padding: 13, fontSize: 16 };

  return (
    <View>
      <Text style={{ color: t.text, fontSize: 22, fontWeight: "700" }}>New Goal</Text>

      <FieldLabel>Title</FieldLabel>
      <TextInput value={title} onChangeText={setTitle} placeholder="e.g. Tennis practice" placeholderTextColor={t.faint} style={input} />

      <FieldLabel>Category (domain › specific)</FieldLabel>
      <TextInput value={category} onChangeText={setCategory} placeholder="sports > tennis" placeholderTextColor={t.faint} style={input} />

      <FieldLabel>Time per session: {hours}h</FieldLabel>
      <Slider minimumValue={0.5} maximumValue={6} step={0.5} value={hours} onValueChange={setHours} minimumTrackTintColor={t.accent} maximumTrackTintColor={t.stroke} thumbTintColor={t.accent} />

      <FieldLabel>Preferred time of day</FieldLabel>
      <Segmented options={TIMES} value={time} onChange={setTime} />

      <FieldLabel>Repeats</FieldLabel>
      <Segmented options={REPEATS} value={repeat} onChange={setRepeat} />

      {error && <Sub style={{ color: t.danger, marginTop: 12 }}>{error}</Sub>}

      <Btn label={saving ? "Saving…" : "Add Goal"} disabled={saving || !title.trim()} onPress={save} />
      <Btn label="Cancel" ghost onPress={onClose} />
    </View>
  );
}
