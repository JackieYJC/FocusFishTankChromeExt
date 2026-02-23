// ─── Shared constants ────────────────────────────────────────────────────────
// Single source of truth — imported by background, popup, and settings.

import type { FishType } from './types';

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
  basic: 24, long: 22, round: 21,
};

export interface ShopItem {
  type: FishType;
  name: string;
  desc: string;
  cost: number;
}

export const SHOP_ITEMS: ShopItem[] = [
  { type: 'basic', name: 'Classic', desc: 'A cheerful, dependable companion', cost: 30  },
  { type: 'long',  name: 'Tetra',   desc: 'Sleek, fast, forked tail',         cost: 60  },
  { type: 'round', name: 'Puffer',  desc: 'Chubby, spiky, big personality',   cost: 100 },
];
