import { v } from 'convex/values'
import { query } from './_generated/server'
import { getGame, searchGamesWithRecoveredClips } from './model/games'

const MAX_GAMES = 20

/** Games the feed can be filtered by, matching `text`; the most recovered when it's empty. */
export const search = query({
  args: { text: v.string() },
  handler: async (ctx, { text }) => {
    const games = await searchGamesWithRecoveredClips(ctx, text.trim(), MAX_GAMES)
    return games.map((game) => ({
      gameId: game.gameId,
      name: game.name,
      recoveredCount: game.recoveredCount,
    }))
  },
})

/** One game's name, for showing the feed's current game filter. */
export const get = query({
  args: { gameId: v.string() },
  handler: async (ctx, { gameId }) => {
    const game = await getGame(ctx, gameId)
    return game ? { gameId: game.gameId, name: game.name } : null
  },
})
