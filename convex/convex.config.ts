import { defineApp } from 'convex/server'
import { v } from 'convex/values'
import rateLimiter from '@convex-dev/rate-limiter/convex.config.js'

const app = defineApp({
  env: {
    // The admin panel's password. Signing in is disabled while it isn't set.
    ADMIN_PASSWORD: v.optional(v.string()),
  },
})
app.use(rateLimiter)

export default app
