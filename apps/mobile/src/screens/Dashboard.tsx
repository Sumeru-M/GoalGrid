import { useMemo } from "react";
import { Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useApp } from "../appContext";
import { useTheme, featuredPriorityColor } from "../theme";
import { Btn, Card, Dot, H1, Screen, Sub } from "../components/ui";
import { dur, hm, shortDate, todayISO, weekdayLetter } from "../lib/format";

export function Dashboard() {
  const t = useTheme();
  const nav = useNavigation<any>();
  const { data, openReschedule } = useApp();
  const today = todayISO();
  const day = data.schedule?.days.find((d) => d.date === today) ?? data.schedule?.days[0];
  const done = data.completedTodayByGoal;

  const { pct, planned, doneCount } = useMemo(() => {
    const blocks = day?.blocks ?? [];
    let p = 0, c = 0, dc = 0;
    for (const b of blocks) {
      const m = b.end - b.start;
      p += m;
      if (done[b.goalId]) { c += m; dc++; }
    }
    return { pct: p === 0 ? 0 : Math.round((c / p) * 100), planned: blocks.length, doneCount: dc };
  }, [day, done]);

  const weekMax = Math.max(1, ...(data.schedule?.days.map((d) => d.usedMinutes) ?? [1]));
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <Screen>
      <View style={{ paddingTop: 8 }}>
        <H1>{greet} 👋</H1>
        <Sub>Let's crush your goals today.</Sub>
      </View>

      <Card featured>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
          <View>
            <Text style={{ color: t.inkFeatured, opacity: 0.6, fontSize: 13 }}>Today's Plan</Text>
            <Text style={{ color: t.inkFeatured, fontWeight: "700", marginTop: 2 }}>{day ? shortDate(day.date) : "—"}</Text>
          </View>
          <View style={{ backgroundColor: t.dark ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.15)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
            <Text style={{ color: t.inkFeatured, fontSize: 11, fontWeight: "700" }}>{day?.blocks.length ?? 0} tasks</Text>
          </View>
        </View>

        <View style={{ marginTop: 8 }}>
          {day && day.blocks.length > 0 ? day.blocks.slice(0, 6).map((b, i) => {
            const isDone = !!done[b.goalId];
            return (
              <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11, borderBottomWidth: i === Math.min(5, day.blocks.length - 1) ? 0 : 1, borderBottomColor: t.dark ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.12)", opacity: isDone ? 0.55 : 1 }}>
                <Dot color={featuredPriorityColor(t, b.priorityLevel)} />
                <Text style={{ color: t.inkFeatured, opacity: 0.6, width: 74, fontSize: 13 }}>{hm(b.start)}</Text>
                <Text style={{ color: t.inkFeatured, flex: 1, fontSize: 15, fontWeight: "500", textDecorationLine: isDone ? "line-through" : "none" }}>{b.title}</Text>
                <Text style={{ color: t.inkFeatured, opacity: 0.6, fontSize: 13 }}>{isDone ? "✓" : dur(b.end - b.start)}</Text>
              </View>
            );
          }) : <Sub>No tasks scheduled today.</Sub>}
        </View>

        <Btn label="View Full Schedule →" ghost onFeatured onPress={() => nav.navigate("Calendar")} />
      </Card>

      <Card>
        <Text style={{ color: t.text, fontWeight: "700" }}>Today's Progress</Text>
        <Sub>
          {planned === 0 ? "Nothing scheduled today." : `${doneCount} of ${planned} done · ${pct >= 70 ? "great follow-through!" : "keep going!"}`}
        </Sub>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 12 }}>
          <Text style={{ color: t.text, fontSize: 22, fontWeight: "800", width: 56 }}>{pct}%</Text>
          <View style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: t.stroke, overflow: "hidden" }}>
            <View style={{ width: `${pct}%`, height: "100%", backgroundColor: t.accent }} />
          </View>
        </View>
      </Card>

      <Card>
        <Text style={{ color: t.muted, fontSize: 13 }}>This Week Overview</Text>
        <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", height: 72, marginTop: 12, gap: 8 }}>
          {(data.schedule?.days ?? []).map((d, i) => (
            <View key={i} style={{ flex: 1, alignItems: "center" }}>
              <View style={{ width: "100%", height: Math.max(6, (d.usedMinutes / weekMax) * 56), backgroundColor: t.text, opacity: 0.9, borderRadius: 5 }} />
              <Text style={{ color: t.faint, fontSize: 11, marginTop: 8 }}>{weekdayLetter(d.date)}</Text>
            </View>
          ))}
        </View>
      </Card>

      <Btn label="Recover missed days" ghost onPress={openReschedule} />
    </Screen>
  );
}
