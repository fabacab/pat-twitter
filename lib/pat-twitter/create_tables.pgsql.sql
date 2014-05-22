--
-- This is the PostgreSQL initialization file for PAT-Twitter.
--
CREATE TABLE users (
    twitter_id BIGINT PRIMARY KEY,
    twitter_screen_name VARCHAR(15) NOT NULL UNIQUE,
    twitter_data TEXT NOT NULL,
    twitter_oauth_token TEXT,
    twitter_oauth_token_secret TEXT,
    last_modified TIMESTAMP NOT NULL DEFAULT NOW(),
    creation_time TIMESTAMP NOT NULL DEFAULT NOW(),
    login_hash TEXT
);
CREATE TABLE alert_lists (
    id BIGSERIAL PRIMARY KEY,
    list_type VARCHAR(50) NOT NULL,
    list_name VARCHAR(255) NOT NULL DEFAULT '',
    list_desc TEXT DEFAULT '',
    author_id BIGINT NOT NULL REFERENCES users(twitter_id),
    last_modified TIMESTAMP NOT NULL DEFAULT NOW(),
    creation_time TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE TABLE alerts (
    id BIGSERIAL PRIMARY KEY,
    list_id BIGINT NOT NULL REFERENCES alert_lists(id),
    twitter_id BIGINT NOT NULL,
    twitter_data TEXT NOT NULL,
    alerted_by BIGINT NOT NULL REFERENCES users(twitter_id),
    alert_desc TEXT,
    last_modified TIMESTAMP NOT NULL DEFAULT NOW(),
    creation_time TIMESTAMP NOT NULL DEFAULT NOW(),

-- The following table CONSTRAINT ensures no Twitter
-- user can be added to the same list more than once.

    CONSTRAINT once_per_list UNIQUE (list_id, twitter_id)
);
