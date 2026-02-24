// ─── Shared domain types ────────────────────────────────────────────────────

export type FishType  = 'basic' | 'long' | 'round' | 'angel' | 'betta' | 'dragon';
export type FishStage = 'fry' | 'juvenile' | 'adult' | 'dead';

export type DecorationType = 'kelp' | 'coral_fan' | 'coral_branch' | 'anemone' | 'treasure_chest';

export type BackgroundType = 'default' | 'twilight' | 'kelp_forest' | 'coral_reef' | 'abyss' | 'bioluminescent' | 'golden_reef';

export type UITheme = 'ocean' | 'midnight' | 'coral' | 'forest' | 'classic';

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

/** Serialisable decoration snapshot — what gets written to chrome.storage.local */
export interface DecorationSnapshot {
  id:          string;
  type:        DecorationType;
  x:           number;   // canvas pixel x (0–360)
  y:           number;   // canvas pixel y, bottom region (≈155–240)
  hue:         number;
  scale:       number;   // size multiplier, typically 0.85–1.15
  releasedAt?: number;
}

export interface WorkHours {
  enabled: boolean;
  start:   string;   // "HH:MM"
  end:     string;
  days:    number[]; // 0=Sun … 6=Sat
}

/** Subset of chrome.storage.local used by applyState / poll */
export interface AppState {
  focusScore:     number;
  focusSecs:      number;
  distractedSecs: number;
  isDistracting:  boolean;
  currentSite:    string;
  coins:          number;
}
