import { useEffect, useMemo, useState } from "react";
import { Text, View } from "react-native";
import { useApp } from "../appContext";
import { useTheme } from "../theme";
import { Btn, Card, Segmented, Sub } from "../components/ui";
import { api } from "../lib/api";
import { addDaysISO, dur, prettyDate, todayISO } from "../lib/format";

interface MissedDay { date: string; outstandingMinutes: number; count: number; goalIds: string[]; }
type Decision = "reschedule" | "done";
const LOOKBACK_DAYS = 7;

const CHOICES = [
  { value: "reschedule" as Decision, label: "Reschedule" },
  { value: "done" as Decision, label: "I already did it" },
];

export function Reschedule({ onClose }: { onClose: () => void }) {
  const t = useTheme();
  const { data } = useApp();
  const today = todayISO();
  const lookbackFrom = addDaysISO(today, -LOOKBACK_DAYS);

  const [loading, setLoading] = useState(true);
  const [missed, setMissed] = useState<MissedDay[]>([]);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const [summary, setSummary] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const completedByDate = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    for (const o of data.outcomes) if (o.completed) (map[o.date] ??= new Set()).add(o.goalId);
    return map;
  }, [data.outcomes]);
  const trackingStart = useMemo(() => data.outcomes.map((o) => o.date).sort()[0] ?? null, [data.outcomes]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true); setError(null);
      try {
        if (!trackingStart) { if (!cancelled) { setMissed([]); setDecisions({}); } return; }
        const { schedule } = await api.plan("weekly", lookbackFrom);
        const days: MissedDay[] = [];
        for (const day of schedule.days) {
          if (day.date >= today || day.date < trackingStart) continue;
          const doneSet = completedByDate[day.date] ?? new Set<string>();
          const outstanding = day.blocks.filter((b) => !doneSet.has(b.goalId));
          const minutes = outstanding.reduce((s, b) => s + (b.end - b.start), 0);
          if (minutes > 0) {
            const goalIds = [...new Set(outstanding.map((b) => b.goalId))];
            days.push({ date: day.date, outstandingMinutes: minutes, count: goalIds.length, goalIds });
          }
        }
        if (cancelled) return;
        setMissed(days);
        setDecisions(Object.fromEntries(days.map((d) => [d.date, "reschedule" as Decision])));
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Couldn't check your recent days.");
      } finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [lookbackFrom, today, completedByDate, trackingStart]);

  async function apply() {
    setBusy(true); setError(null);
    try {
      const doneDays = missed.filter((m) => decisions[m.date] === "done");
      const rescheduleDays = missed.filter((m) => decisions[m.date] !== "done").map((m) => m.date).sort();
      let marked = 0;
      for (const d of doneDays) for (const goalId of d.goalIds) { await api.recordOutcome(goalId, true, d.date); marked++; }
      const lines: string[] = [];
      if (doneDays.length) lines.push(`Marked ${marked} task${marked > 1 ? "s" : ""} across ${doneDays.length} day${doneDays.length > 1 ? "s" : ""} as already completed`);
      if (rescheduleDays.length) {
        const { result } = await api.reschedule({ horizon: "weekly", from: lookbackFrom, replanFrom: today, missedDates: rescheduleDays });
        data.setSchedule(result.schedule);
        lines.push(...result.summary);
      } else lines.push("Nothing to reschedule — your upcoming days are unchanged.");
      await data.refreshOutcomes();
      setSummary(lines);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't apply. Try again.");
    } finally { setBusy(false); }
  }

  const rescheduleCount = missed.filter((m) => decisions[m.date] !== "done").length;
  const doneCount = missed.filter((m) => decisions[m.date] === "done").length;
  const rescheduleMinutes = missed.filter((m) => decisions[m.date] !== "done").reduce((s, m) => s + m.outstandingMinutes, 0);

  const label = busy ? "Applying…"
    : rescheduleCount && doneCount ? `Reschedule ${dur(rescheduleMinutes)} · mark ${doneCount} done`
    : rescheduleCount ? `Recover ${dur(rescheduleMinutes)} across upcoming days`
    : `Mark ${doneCount} day${doneCount > 1 ? "s" : ""} as already done`;

  if (loading) return <View><Text style={{ color: t.text, fontSize: 22, fontWeight: "700" }}>Reschedule</Text><Sub>Checking your recent days…</Sub></View>;

  if (!summary && missed.length === 0) {
    return (
      <View>
        <Text style={{ color: t.text, fontSize: 22, fontWeight: "700" }}>Reschedule</Text>
        <View style={{ alignItems: "center", paddingVertical: 30 }}>
          <Text style={{ fontSize: 40, marginBottom: 12 }}>🎉</Text>
          <Text style={{ color: t.text, fontWeight: "600" }}>You're all caught up</Text>
          <Sub style={{ textAlign: "center" }}>No missed days in the past week — nothing to reschedule.</Sub>
        </View>
        <Btn label="Done" onPress={onClose} />
      </View>
    );
  }

  return (
    <View>
      <Text style={{ color: t.text, fontSize: 22, fontWeight: "700" }}>Reschedule</Text>

      {summary ? (
        <Card>
          <Text style={{ color: t.muted, fontSize: 13, marginBottom: 6 }}>Reschedule Summary</Text>
          {summary.map((line, i) => (
            <View key={i} style={{ flexDirection: "row", gap: 10, paddingVertical: 10 }}>
              <Text style={{ color: t.text, fontWeight: "700" }}>✔</Text>
              <Text style={{ color: t.text, flex: 1 }}>{line}</Text>
            </View>
          ))}
        </Card>
      ) : (
        <>
          <View style={{ flexDirection: "row", gap: 12, backgroundColor: t.card, borderColor: t.strokeStrong, borderWidth: 1, borderLeftWidth: 3, borderLeftColor: t.danger, borderRadius: t.radiusSm, padding: 14, marginTop: 14 }}>
            <Text style={{ fontSize: 20 }}>⚠️</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.text, fontWeight: "600" }}>{missed.length === 1 ? `1 day looks unfinished (${prettyDate(missed[0].date)})` : `${missed.length} days look unfinished in the past week`}</Text>
              <Sub>For each day, reschedule the work — or if you actually did it and just forgot to mark it, choose “I already did it” so it isn’t moved.</Sub>
            </View>
          </View>

          {missed.map((m) => (
            <Card key={m.date}>
              <Text style={{ color: t.text, fontWeight: "600" }}>{prettyDate(m.date)}</Text>
              <Text style={{ color: t.muted, fontSize: 12, marginTop: 2, marginBottom: 8 }}>{m.count} task{m.count > 1 ? "s" : ""} · {dur(m.outstandingMinutes)} outstanding</Text>
              <Segmented options={CHOICES} value={decisions[m.date] ?? "reschedule"} onChange={(v) => setDecisions((p) => ({ ...p, [m.date]: v }))} />
            </Card>
          ))}
        </>
      )}

      {error && <Sub style={{ color: t.danger, marginTop: 12 }}>{error}</Sub>}
      <Btn label={summary ? "Done" : label} disabled={busy} onPress={summary ? onClose : apply} />
    </View>
  );
}
