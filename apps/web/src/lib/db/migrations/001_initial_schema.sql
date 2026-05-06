-- Enable pgcrypto for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Users (linked to NextAuth accounts table)
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT UNIQUE NOT NULL,
  name          TEXT,
  image         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- OAuth tokens for each platform per user
CREATE TABLE IF NOT EXISTS platform_accounts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform          TEXT NOT NULL CHECK (platform IN ('youtube', 'tiktok', 'instagram')),
  platform_user_id  TEXT NOT NULL,
  access_token      TEXT NOT NULL,
  refresh_token     TEXT,
  token_expires_at  TIMESTAMPTZ,
  scope             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, platform)
);

-- Streams: a single YouTube live stream session
CREATE TABLE IF NOT EXISTS streams (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  youtube_stream_id   TEXT NOT NULL,
  youtube_video_id    TEXT,
  title               TEXT,
  status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'ingesting', 'completed', 'failed')),
  hls_manifest_url    TEXT,
  started_at          TIMESTAMPTZ,
  ended_at            TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Individual HLS segments stored in S3
CREATE TABLE IF NOT EXISTS stream_segments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id       UUID NOT NULL REFERENCES streams(id) ON DELETE CASCADE,
  segment_index   INTEGER NOT NULL,
  s3_key          TEXT NOT NULL,
  duration_secs   NUMERIC(8, 3) NOT NULL,
  started_at      TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (stream_id, segment_index)
);

-- Chat messages fetched from YouTube Live Chat API
CREATE TABLE IF NOT EXISTS chat_messages (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id               UUID NOT NULL REFERENCES streams(id) ON DELETE CASCADE,
  youtube_msg_id          TEXT UNIQUE NOT NULL,
  author_name             TEXT,
  message_text            TEXT,
  published_at            TIMESTAMPTZ NOT NULL,
  is_superchat            BOOLEAN NOT NULL DEFAULT FALSE,
  superchat_amount_micros BIGINT
);

-- Whisper transcription results per segment
CREATE TABLE IF NOT EXISTS transcriptions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id       UUID NOT NULL REFERENCES streams(id) ON DELETE CASCADE,
  segment_index   INTEGER,
  text            TEXT NOT NULL,
  words_json      JSONB,
  started_at      TIMESTAMPTZ NOT NULL,
  ended_at        TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Generated clips
CREATE TABLE IF NOT EXISTS clips (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id           UUID NOT NULL REFERENCES streams(id) ON DELETE CASCADE,
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title               TEXT,
  status              TEXT NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'processing', 'ready', 'rejected', 'published')),
  start_offset_secs   NUMERIC(10, 3) NOT NULL,
  end_offset_secs     NUMERIC(10, 3) NOT NULL,
  duration_secs       NUMERIC(8, 3) GENERATED ALWAYS AS (end_offset_secs - start_offset_secs) STORED,
  raw_s3_key          TEXT,
  converted_s3_key    TEXT,
  thumbnail_s3_key    TEXT,
  subtitles_srt       TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Scoring breakdown per clip
CREATE TABLE IF NOT EXISTS clip_scores (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clip_id                   UUID NOT NULL REFERENCES clips(id) ON DELETE CASCADE,
  overall_score             NUMERIC(5, 2) NOT NULL,
  audio_peak_score          NUMERIC(5, 2),
  chat_activity_score       NUMERIC(5, 2),
  transcript_score          NUMERIC(5, 2),
  engagement_history_score  NUMERIC(5, 2),
  score_metadata            JSONB,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Publication records
CREATE TABLE IF NOT EXISTS publications (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clip_id             UUID NOT NULL REFERENCES clips(id) ON DELETE CASCADE,
  platform_account_id UUID NOT NULL REFERENCES platform_accounts(id),
  platform            TEXT NOT NULL CHECK (platform IN ('youtube', 'tiktok', 'instagram')),
  status              TEXT NOT NULL DEFAULT 'queued'
                        CHECK (status IN ('queued', 'uploading', 'published', 'failed')),
  platform_post_id    TEXT,
  platform_post_url   TEXT,
  scheduled_for       TIMESTAMPTZ,
  published_at        TIMESTAMPTZ,
  error_message       TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_streams_user_id ON streams(user_id);
CREATE INDEX IF NOT EXISTS idx_streams_status ON streams(status);
CREATE INDEX IF NOT EXISTS idx_stream_segments_stream_id ON stream_segments(stream_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_stream_id_published ON chat_messages(stream_id, published_at);
CREATE INDEX IF NOT EXISTS idx_transcriptions_stream_id ON transcriptions(stream_id);
CREATE INDEX IF NOT EXISTS idx_clips_stream_id ON clips(stream_id);
CREATE INDEX IF NOT EXISTS idx_clips_user_id_status ON clips(user_id, status);
CREATE INDEX IF NOT EXISTS idx_clip_scores_clip_id ON clip_scores(clip_id);
CREATE INDEX IF NOT EXISTS idx_clip_scores_overall ON clip_scores(overall_score DESC);
CREATE INDEX IF NOT EXISTS idx_publications_clip_id ON publications(clip_id);
