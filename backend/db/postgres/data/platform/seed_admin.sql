-- =============================================================================
-- SERVICE CATALOGUE — PostgreSQL platform seed
-- data/platform/seed_admin.sql
-- Default administrator account for clean init
-- =============================================================================

SET search_path TO platform, public;

INSERT INTO users (
    username,
    display_name,
    email,
    role,
    is_active,
    preferred_lang,
    preferred_theme,
    password_hash
)
VALUES (
    'admin',
    'Admin',
    '',
    'admin',
    TRUE,
    'cz',
    'dark',
    '$2b$12$l2iL4gXDhBPX3PHoPRihM.Osd6UQxXjSxdyEaBtN/pj/UH69zdIre'
)
ON CONFLICT (username) DO NOTHING;

UPDATE users
SET password_hash = '$2b$12$l2iL4gXDhBPX3PHoPRihM.Osd6UQxXjSxdyEaBtN/pj/UH69zdIre'
WHERE username = 'admin'
  AND password_hash IS NULL;
