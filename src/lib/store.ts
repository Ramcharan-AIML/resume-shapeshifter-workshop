"use client";

import { useEffect, useState } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { ApplicationKit, TailoringResult } from "./schema";

interface ShapeshifterStore {
  result: TailoringResult | null;
  resumeText: string;
  jdText: string;
  applicationKit: ApplicationKit | null;
  setResult: (
    result: TailoringResult,
    resumeText: string,
    jdText: string
  ) => void;
  setApplicationKit: (kit: ApplicationKit | null) => void;
  clear: () => void;
}

export const useShapeshifterStore = create<ShapeshifterStore>()(
  persist(
    (set) => ({
      result: null,
      resumeText: "",
      jdText: "",
      applicationKit: null,
      setResult: (result, resumeText, jdText) =>
        set({ result, resumeText, jdText, applicationKit: null }),
      setApplicationKit: (kit) => set({ applicationKit: kit }),
      clear: () =>
        set({
          result: null,
          resumeText: "",
          jdText: "",
          applicationKit: null,
        }),
    }),
    {
      name: "resume-shapeshifter",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        result: state.result,
        resumeText: state.resumeText,
        jdText: state.jdText,
        applicationKit: state.applicationKit,
      }),
    }
  )
);

export function useHasHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    const unsub = useShapeshifterStore.persist.onFinishHydration(() =>
      setHydrated(true)
    );
    if (useShapeshifterStore.persist.hasHydrated()) {
      setHydrated(true);
    }
    return () => {
      unsub();
    };
  }, []);
  return hydrated;
}
