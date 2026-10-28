import { cronJobs } from 'convex/server'
import { internal } from './_generated/api'

const crons = cronJobs()

crons.interval('recount site stats', { minutes: 30 }, internal.siteStats.recount, {})

export default crons
