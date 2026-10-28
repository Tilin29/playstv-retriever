import type { MutationCtx, QueryCtx } from '../_generated/server'

async function getGame(ctx: QueryCtx, gameId: string) {
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

/** Games with at least one recovered clip, most recovered first. */
export async function listGamesWithRecoveredClips(ctx: QueryCtx, limit: number) {
  return await ctx.db
    .query('games')
    .withIndex('by_recoveredCount', (q) => q.gt('recoveredCount', 0))
    .order('desc')
    .take(limit)
}
