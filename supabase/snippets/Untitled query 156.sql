
SELECT
  email_normalized,
  role,
  role_title,
  is_active,
  activated_at
FROM public.profiles
WHERE auth_user_id =
  '6d1156ef-e2d4-4078-9cd9-f55c9fc8ddd1'::uuid;
