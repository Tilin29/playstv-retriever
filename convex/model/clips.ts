import { ConvexError } from 'convex/values'
import { internal } from '../_generated/api'
import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import { countRecoveredClip } from './games'
import { clipMediaUrl } from './playstv'
import { rawCaptureUrl } from './wayback'

/**
 * Checks one clip's full video again after the Archive didn't respond the first time.
 * Only allowed for clips whose check failed.
 */
export async function retryClipVideo(ctx: MutationCtx, clipId: Id<'clips'>) {
  const clip = await ctx.db.get('clips', clipId)
  if (!clip) throw new ConvexError('Clip not found')
  if (clip.videoStatus !== 'failed') throw new ConvexError("This clip's check didn't fail")

  await ctx.db.patch('clips', clipId, { videoStatus: 'checking' })
  await ctx.scheduler.runAfter(0, internal.retrieval.checkOneClipVideo, { clipId })
}

/**
 * Counts a clip's full video `delta` more (or fewer) times in its profile's and game's
 * recovered counts. Blacklisted clips aren't counted, so the feed's game filter never
 * offers a game whose only clips are hidden.
 */
export async function adjustRecoveredCounts(ctx: MutationCtx, clip: Doc<'clips'>, delta: number) {
  const profile = await ctx.db.get('profiles', clip.profileId)
  if (profile?.recoveredCount !== undefined) {
    await ctx.db.patch('profiles', profile._id, { recoveredCount: profile.recoveredCount + delta })
  }
  if (clip.gameId) await countRecoveredClip(ctx, clip.gameId, delta)
}

/**
 * Returns a function that loads a clip's profile for display, reading each profile once
 * (a page often holds several clips of the same one). Null when it has no snapshot.
 */
export function createOwnerLoader(ctx: QueryCtx) {
  const load = async (profileId: Id<'profiles'>) => {
    const profile = await ctx.db.get('profiles', profileId)
    if (!profile?.snapshotTimestamp) return null
    return {
      timestamp: profile.snapshotTimestamp,
      hidden: profile.hiddenAt !== undefined,
      username: profile.username,
      usernameKey: profile.usernameKey,
      avatarUrl: profile.avatarStorageId ? await ctx.storage.getUrl(profile.avatarStorageId) : null,
    }
  }
  const owners = new Map<Id<'profiles'>, ReturnType<typeof load>>()
  return (profileId: Id<'profiles'>) => {
    let owner = owners.get(profileId)
    if (!owner) {
      owner = load(profileId)
      owners.set(profileId, owner)
    }
    return owner
  }
}

/**
 * A clip together with its profile, or null when the profile has no snapshot or was
 * hidden (unless `includeHiddenProfile` is set).
 */
export async function toOwnedClipView(
  ctx: QueryCtx,
  clip: Doc<'clips'>,
  loadOwner: ReturnType<typeof createOwnerLoader>,
  options?: ClipViewOptions,
) {
  const owner = await loadOwner(clip.profileId)
  if (!owner || (owner.hidden && !options?.includeHiddenProfile)) return null
  const { timestamp, hidden: _hidden, ...ownerView } = owner
  return { ...(await toClipView(ctx, clip, timestamp, options)), owner: ownerView }
}

/**
 * For the admin panel: `revealTitle` includes a hidden title, `includeHiddenProfile`
 * keeps clips of hidden profiles.
 */
type ClipViewOptions = { revealTitle?: boolean; includeHiddenProfile?: boolean }

/**
 * What the app shows of a clip. `timestamp` is its profile's snapshot. A title an admin
 * hid is null (with `titleHidden` set) unless `revealTitle` is set.
 */
export async function toClipView(
  ctx: QueryCtx,
  clip: Doc<'clips'>,
  timestamp: string,
  { revealTitle = false }: ClipViewOptions = {},
) {
  // Until a copy is stored, previews play straight from the Wayback Machine
  // (unless the download already found that the Archive never saved them).
  const archived = (file: Parameters<typeof clipMediaUrl>[1]) =>
    clip.mediaStatus === 'missing' ? null : rawCaptureUrl(timestamp, clipMediaUrl(clip, file))
  const titleHidden = clip.titleHidden ?? false

  return {
    _id: clip._id,
    title: titleHidden && !revealTitle ? null : clip.title,
    titleHidden,
    durationSeconds: clip.durationSeconds ?? null,
    uploadedAt: clip.uploadedAt ?? null,
    gameName: clip.gameName ?? null,
    mediaStatus: clip.mediaStatus,
    videoStatus: clip.videoStatus,
    videoUrl: clip.videoUrl ?? null,
    videoQuality: clip.videoQuality ?? null,
    previewUrl: clip.previewStorageId
      ? await ctx.storage.getUrl(clip.previewStorageId)
      : archived('preview_144.mp4'),
    thumbnailUrl: clip.thumbnailStorageId
      ? await ctx.storage.getUrl(clip.thumbnailStorageId)
      : archived('480.jpg'),
  }
}
