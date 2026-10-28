import { cronJobs } from 'convex/server'
import { internal } from './_generated/api'

const crons = cronJobs()

crons.interval('delete expired clip media', { hours: 1 }, internal.cleanup.deleteExpiredMedia, {})

export default crons
