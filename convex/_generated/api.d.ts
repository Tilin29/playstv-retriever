/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as archive from "../archive.js";
import type * as cleanup from "../cleanup.js";
import type * as clips from "../clips.js";
import type * as games from "../games.js";
import type * as migrations from "../migrations.js";
import type * as model_archive from "../model/archive.js";
import type * as model_clips from "../model/clips.js";
import type * as model_games from "../model/games.js";
import type * as model_playstv from "../model/playstv.js";
import type * as model_profiles from "../model/profiles.js";
import type * as model_wayback from "../model/wayback.js";
import type * as profiles from "../profiles.js";
import type * as retrieval from "../retrieval.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  archive: typeof archive;
  cleanup: typeof cleanup;
  clips: typeof clips;
  games: typeof games;
  migrations: typeof migrations;
  "model/archive": typeof model_archive;
  "model/clips": typeof model_clips;
  "model/games": typeof model_games;
  "model/playstv": typeof model_playstv;
  "model/profiles": typeof model_profiles;
  "model/wayback": typeof model_wayback;
  profiles: typeof profiles;
  retrieval: typeof retrieval;
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
