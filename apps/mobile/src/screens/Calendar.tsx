import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useApp } from "../appContext";
import { useTheme, priorityColor } from "../theme";
import { Card, H1, Screen, Sub } from "../components/ui";
import { dur, hm } from "../lib/format";

export function Calendar() {
  const t = useTheme();
  const { data } = useApp();
  const days = data.schedule?.days ?? [];
  const [sel, setSel] = useState(0);
  const day = days[sel];

  return (
    <Screen>
      <View style={{ paddingTop: 8 }}><H1>Calendar</H1></View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 14 }} contentContainerStyle={{ gap: 10 }}>
        {days.map((d, i) => {
          const date = new Date(d.date + "T00:00:00Z");
          const on = i === sel;
          return (
            <Pressable key={d.date} onPress={() => setSel(i)} style={{ minWidth: 52, paddingVertical: 10, paddingHorizontal: 6, borderRadius: t.radiusSm, borderWidth: 1, borderColor: on ? t.accent : t.stroke, backgroundColor: on ? t.accent : t.card, alignItems: "center" }}>
              <Text style={{ fontSize: 11, color: on ? t.onAccent : t.muted }}>{["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"][date.getUTCDay()]}</Text>
              <Text style={{ fontSize: 18, fontWeight: "700", color: on ? t.onAccent : t.text }}>{date.getUTCDate()}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Card>
        {day && day.blocks.length > 0 ? day.blocks.map((b, i) => (
          <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 }}>
            <Text style={{ color: t.muted, width: 74, fontSize: 13 }}>{hm(b.start)}</Text>
            <View style={{ flex: 1, backgroundColor: t.dark ? "#1e1e1e" : "#f2f2f5", borderLeftWidth: 3, borderLeftColor: priorityColor(t, b.priorityLevel), borderRadius: 8, padding: 12 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: t.text, fontWeight: "600" }}>{b.title}</Text>
                <Text style={{ color: t.muted, fontSize: 13 }}>{dur(b.end - b.start)}</Text>
              </View>
              <Text style={{ color: t.muted, fontSize: 12, marginTop: 2 }}>{b.category.join(" › ")}</Text>
            </View>
          </View>
        )) : <Sub style={{ textAlign: "center", paddingVertical: 20 }}>Nothing scheduled this day.</Sub>}
      </Card>

      {day && <Sub style={{ textAlign: "center" }}>{dur(day.usedMinutes)} planned of {dur(day.capacityMinutes)} free</Sub>}
    </Screen>
  );
}
