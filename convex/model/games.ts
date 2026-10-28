import type { MutationCtx, QueryCtx } from '../_generated/server'

export async function getGame(ctx: QueryCtx, gameId: string) {
  return await ctx.db
    .query('games')
    .withIndex('by_gameId', (q) => q.eq('gameId', gameId))
    .unique()
}

/** Adds the games of newly stored clips that aren't known yet. */
export async function addGames(ctx: MutationCtx, clips: { gameId?: string; gameName?: string }[]) {
  const names = new Map<string, string>()
  for (const { gameId, gameName } of clips) {
    if (gameId && gameName) names.set(gameId, gameName)
  }
  for (const [gameId, name] of names) {
    if (!(await getGame(ctx, gameId))) {
      await ctx.db.insert('games', { gameId, name, recoveredCount: 0 })
    }
  }
}

/** Counts `count` more recovered clips for the game. */
export async function countRecoveredClip(ctx: MutationCtx, gameId: string, count = 1) {
  const game = await getGame(ctx, gameId)
  if (game) await ctx.db.patch('games', game._id, { recoveredCount: game.recoveredCount + count })
}

// Search results include games without recovered clips, which are skipped, so a few
// more are read than are returned.
const SEARCH_READ_FACTOR = 3

/**
 * Games with at least one recovered clip: the most recovered first, or, given `text`,
 * the best matches for it.
 */
export async function searchGamesWithRecoveredClips(ctx: QueryCtx, text: string, limit: number) {
  if (!text) {
    return await ctx.db
      .query('games')
      .withIndex('by_recoveredCount', (q) => q.gt('recoveredCount', 0))
      .order('desc')
      .take(limit)
  }
  const matches = await ctx.db
    .query('games')
    .withSearchIndex('search_name', (q) => q.search('name', text))
    .take(limit * SEARCH_READ_FACTOR)
  return matches.filter((game) => game.recoveredCount > 0).slice(0, limit)
}