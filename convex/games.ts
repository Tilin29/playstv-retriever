import { query } from './_generated/server'
import { listGamesWithRecoveredClips } from './model/games'

const MAX_GAMES = 100

/** The games the feed can be filtered by. */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const games = await listGamesWithRecoveredClips(ctx, MAX_GAMES)
    return games.map((game) => ({
      gameId: game.gameId,
      name: game.name,
      recoveredCount: game.recoveredCount,
    }))
  },
})
