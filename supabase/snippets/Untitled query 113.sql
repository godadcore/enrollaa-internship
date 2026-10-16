
SELECT
    u.id AS auth_user_id,
    u.email,
    CASE
        WHEN p.id IS NULL THEN 'No profile yet'
        ELSE 'Profile already exists'
    END AS profile_status,
    p.role,
    p.is_active
FROM auth.users AS u
LEFT JOIN public.profiles AS p
    ON p.auth_user_id = u.id
WHERE u.id = '6d1156ef-e2d4-4078-9cd9-f55c9fc8ddd1'::uuid;
