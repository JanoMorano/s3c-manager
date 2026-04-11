UPDATE platform.users
SET preferred_lang = 'cs'
WHERE preferred_lang IS NULL
   OR lower(preferred_lang) IN ('cz', 'cze', 'cs-cz');
