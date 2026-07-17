import { createContext, useContext } from "react";
import type { AppData } from "./lib/useAppData";

/** Shared app state + navigation actions for modal flows (Add / Reschedule). */
export interface AppCtx {
  data: AppData;
  openAdd: () => void;
  openReschedule: () => void;
}

const Ctx = createContext<AppCtx | null>(null);

export const AppProvider = Ctx.Provider;

export function useApp(): AppCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp must be used within AppProvider");
  return v;
}
