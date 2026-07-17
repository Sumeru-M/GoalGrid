import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import { todayISO } from "./format";
import type { Goal, Schedule, UserProfile } from "goalgrid-core/types";
import type { OutcomeRecord } from "goalgrid-backend/storage/repositories";

/**
 * Central data hook (ported verbatim from the web app — React works the same in
 * RN). Loads on-device state via the backend API client, wraps every read so a
 * failure surfaces as `error` with retry, and exposes today's completions.
 */
export function useAppData() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [outcomes, setOutcomes] = useState<OutcomeRecord[]>([]);

  const reload = useCallback(async () => {
    setError(null);
    try {
      const [{ profile }, { goals }, { outcomes }] = await Promise.all([
        api.getProfile(),
        api.listGoals(),
        api.listOutcomes(),
      ]);
      setProfile(profile);
      setGoals(goals);
      setOutcomes(outcomes);
      if (profile) {
        const { schedule } = await api.plan("weekly", todayISO());
        setSchedule(schedule);
      } else {
        setSchedule(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong loading your data.");
    }
  }, []);

  useEffect(() => {
    (async () => {
      await reload();
      setLoading(false);
    })();
  }, [reload]);

  const refreshOutcomes = useCallback(async () => {
    const { outcomes } = await api.listOutcomes();
    setOutcomes(outcomes);
  }, []);

  const completedTodayByGoal = (() => {
    const today = todayISO();
    const byGoal: Record<string, boolean> = {};
    for (const o of outcomes) if (o.completed && o.date === today) byGoal[o.goalId] = true;
    return byGoal;
  })();

  return {
    loading, error, profile, goals, schedule, outcomes,
    completedTodayByGoal, reload, setSchedule, refreshOutcomes,
  };
}

export type AppData = ReturnType<typeof useAppData>;
