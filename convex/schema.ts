import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export const videoFields = {
  url: v.string(),
  title: v.optional(v.string()),
}

export default defineSchema({
  videos: defineTable(videoFields).index('by_url', ['url']),
})
