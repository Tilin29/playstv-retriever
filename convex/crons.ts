import { cronJobs } from 'convex/server'
import { internal } from './_generated/api'

const crons = cronJobs()

crons.interval('delete expired profiles', { hours: 1 }, internal.cleanup.deleteExpiredProfiles, {})

export default crons
