// ─── Shared constants ────────────────────────────────────────────────────────
// Single source of truth — imported by background, popup, and settings.

import type { FishType, DecorationType, BackgroundType } from './types';

export const DEFAULT_BLOCKLIST: string[] = [
  'twitter.com', 'x.com', 'reddit.com', 'facebook.com',
  'instagram.com', 'tiktok.com', 'youtube.com', 'twitch.tv',
  'netflix.com', 'hulu.com', 'disneyplus.com', 'primevideo.com',
  'pinterest.com', 'snapchat.com', 'tumblr.com',
];

export const DEFAULT_WORK_HOURS = {
  enabled: true,
  start:   '09:00',
  end:     '18:00',
  days:    [1, 2, 3, 4, 5], // Mon–Fri
} as const;

export const GAME_BALANCE = {
  TICK_SECS:         5,
  DECAY:             1.5,   // score lost per tick on a distracting site
  GAIN:              0.4,   // score gained per tick on a focused site
  COIN_RATE:         0.2,   // coins per tick at focusScore 100, scales linearly
  POMO_DURATION:     25 * 60,
  POMO_REWARD:       25,    // coins on pomodoro completion
  // One full growth stage in ~8 min of 100% focus at 60 fps
  BASE_GROWTH_RATE:  100 / (8 * 60 * 60),
  FOOD_GROWTH_CAP:   35,    // max growth points per stage that can come from food
  FOOD_GROWTH_BONUS: 5,     // growth points per pellet eaten
} as const;

export const STAGE_SIZE_FACTORS: Record<string, number> = {
  fry: 0.38, juvenile: 0.62, adult: 1.0, dead: 1.0,
};

export const DEFAULT_FISH_SIZES: Record<FishType, number> = {
  basic: 36, long: 33, round: 32, angel: 34, betta: 32, dragon: 34,
};

// ─── Food system ──────────────────────────────────────────────────────────────

export const MAX_FOOD         = 15;   // max food pellets in reserve
export const FOOD_REFILL_SECS = 60;   // one pellet refills every 60 seconds

// ─── Fish shop ────────────────────────────────────────────────────────────────

export interface ShopItem {
  type: FishType;
  name: string;
  desc: string;
  cost: number;
}

export const SHOP_ITEMS: ShopItem[] = [
  { type: 'basic',  name: 'Classic',   desc: 'A cheerful, dependable companion',            cost: 30  },
  { type: 'long',   name: 'Tetra',     desc: 'Sleek, fast, forked tail',                    cost: 60  },
  { type: 'round',  name: 'Puffer',    desc: 'Chubby, spiky, big personality',              cost: 100 },
  { type: 'angel',  name: 'Angelfish', desc: 'Elegant, tall-bodied, glides serenely',       cost: 80  },
  { type: 'betta',  name: 'Tang',      desc: 'Deep-bodied reef warrior with a scalpel tail', cost: 120 },
  { type: 'dragon', name: 'Dragonfish', desc: '✦ Rare · Lionfish-like crown of venomous spines', cost: 480 },
];

// ─── Decoration shop ──────────────────────────────────────────────────────────

export interface DecorationShopItem {
  type: DecorationType;
  name: string;
  desc: string;
  cost: number;
  hue:  number;  // representative preview hue
}

export const DECORATION_ITEMS: DecorationShopItem[] = [
  { type: 'kelp',           name: 'Sea Kelp',       desc: 'Tall waving kelp fronds',              cost: 25,  hue: 120 },
  { type: 'coral_fan',      name: 'Fan Coral',      desc: 'Delicate spreading coral fan',         cost: 40,  hue: 310 },
  { type: 'coral_branch',   name: 'Branch Coral',   desc: 'Branching orange coral',               cost: 60,  hue: 20  },
  { type: 'anemone',        name: 'Anemone',        desc: 'Colorful waving tentacles',            cost: 100, hue: 0   },
  { type: 'treasure_chest', name: 'Treasure Chest', desc: '✦ Rare · A gilded chest brimming with gold', cost: 280, hue: 45  },
];

// ─── Background shop ──────────────────────────────────────────────────────────

export interface BackgroundShopItem {
  type: BackgroundType;
  name: string;
  desc: string;
  cost: number;   // 0 = free / always unlocked
}

export const BACKGROUND_ITEMS: BackgroundShopItem[] = [
  { type: 'default',        name: 'Open Ocean',      desc: 'The classic deep-blue home.',                      cost: 0   },
  { type: 'twilight',       name: 'Twilight Zone',   desc: 'Mysterious purple depths.',                        cost: 150 },
  { type: 'kelp_forest',    name: 'Kelp Forest',     desc: 'Dappled green-blue light through tall kelp.',      cost: 180 },
  { type: 'coral_reef',     name: 'Coral Reef',      desc: 'Warm, sun-drenched tropical waters.',              cost: 200 },
  { type: 'abyss',          name: 'The Abyss',       desc: 'Pitch-dark hadal zone. Few survive here.',         cost: 250 },
  { type: 'golden_reef',    name: 'Golden Reef',     desc: '✦ Rare · Amber warmth of a sunlit shallow reef.',  cost: 350 },
  { type: 'bioluminescent', name: 'Bioluminescent',  desc: '✦ Rare · Pitch black, alive with ghostly light.',  cost: 400 },
];

// ─── Decoration health bonus ──────────────────────────────────────────────────
// Each decoration contributes this many points of visual tank health (capped at MAX_DEC_BONUS).

export const DEC_HEALTH_PER    = 3;   // health pts per decoration
export const MAX_DEC_BONUS     = 20;  // cap
