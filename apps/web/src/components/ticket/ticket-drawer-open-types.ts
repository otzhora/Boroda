export type OpenInFeedbackState =
  | { phase: "idle" }
  | { phase: "opening"; appLabel: string; modeLabel: string }
  | { phase: "success"; appLabel: string; modeLabel: string }
  | { phase: "error"; appLabel: string; modeLabel: string; message: string };
