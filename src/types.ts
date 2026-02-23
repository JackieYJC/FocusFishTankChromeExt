// ─── Shared domain types ────────────────────────────────────────────────────

export type FishType  = 'basic' | 'long' | 'round';
export type FishStage = 'fry' | 'juvenile' | 'adult' | 'dead';

/** Serialisable fish snapshot — what gets written to chrome.storage.local */
export interface FishSnapshot {
  id:          string;
  type:        FishType;
  stage:       FishStage;
  hue:         number;
  health:      number;
  maxSize:     number;
  speed:       number;
  growth:      number;
  foodGrowth:  number;
  bornAt?:     number;   // Date.now() when fish was created
  releasedAt?: number;
  diedAt?:     number;   // Date.now() when fish faded out (graveyard only)
}

export interface WorkHours {
  enabled: boolean;
  start:   string;   // "HH:MM"
  end:     string;
  days:    number[]; // 0=Sun … 6=Sat
}

/** Subset of chrome.storage.local used by applyState / poll */
export interface AppState {
  focusScore:             number;
  totalFocusMinutes:      number;
  totalDistractedMinutes: number;
  isDistracting:          boolean;
  currentSite:            string;
  coins:                  number;
}
