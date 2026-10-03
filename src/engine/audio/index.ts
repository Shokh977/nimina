export { DEFAULT_SFX_FOR_ACTION, resolveSfx, SFX_IDS, type SfxId } from './sfx';
export { getSfxEvents, type SfxEvent } from './events';
export { playSfx } from './synth';
export { scheduleDucking, snapToBeat } from './music';
export { renderProjectAudio, type MixOptions } from './mix';
export {
  allAudioClips,
  beatTimes,
  audibleClips,
  audioTracks,
  clipGainAt,
  clipWindow,
  DEFAULT_FADE_OUT,
  DEFAULT_MUSIC_VOLUME,
  findClip,
  migrateLegacyAudio,
  musicClip,
  newMusicClip,
  playableClips,
  scheduleClip,
  sourceTimeAt,
  type AudioBuffers,
} from './clips';
export { MUSIC_TRACK_DEFS, generateProceduralTrack, type MusicTrackDef } from './proceduralMusic';
export { encodeWavMono } from './wav';
