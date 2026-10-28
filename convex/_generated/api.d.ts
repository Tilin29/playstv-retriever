/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as archive from "../archive.js";
import type * as cleanup from "../cleanup.js";
import type * as clipLinks from "../clipLinks.js";
import type * as clips from "../clips.js";
import type * as games from "../games.js";
import type * as migrations from "../migrations.js";
import type * as model_admin from "../model/admin.js";
import type * as model_archive from "../model/archive.js";
import type * as model_clipLinks from "../model/clipLinks.js";
import type * as model_clips from "../model/clips.js";
import type * as model_games from "../model/games.js";
import type * as model_moderation from "../model/moderation.js";
import type * as model_playstv from "../model/playstv.js";
import type * as model_profiles from "../model/profiles.js";
import type * as model_searches from "../model/searches.js";
import type * as model_wayback from "../model/wayback.js";
import type * as profiles from "../profiles.js";
import type * as reports from "../reports.js";
import type * as retrieval from "../retrieval.js";
import type * as searches from "../searches.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  archive: typeof archive;
  cleanup: typeof cleanup;
  clipLinks: typeof clipLinks;
  clips: typeof clips;
  games: typeof games;
  migrations: typeof migrations;
  "model/admin": typeof model_admin;
  "model/archive": typeof model_archive;
  "model/clipLinks": typeof model_clipLinks;
  "model/clips": typeof model_clips;
  "model/games": typeof model_games;
  "model/moderation": typeof model_moderation;
  "model/playstv": typeof model_playstv;
  "model/profiles": typeof model_profiles;
  "model/searches": typeof model_searches;
  "model/wayback": typeof model_wayback;
  profiles: typeof profiles;
  reports: typeof reports;
  retrieval: typeof retrieval;
  searches: typeof searches;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  rateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">;
};
