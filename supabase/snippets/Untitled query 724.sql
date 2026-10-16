
BEGIN;

DO $bootstrap$
DECLARE
  target_auth_user_id uuid :=
    '6d1156ef-e2d4-4078-9cd9-f55c9fc8ddd1'::uuid;
  verified_first_name text := 'Emmanuel';
  verified_surname text := 'Bodunde';
  target_email text;
  new_profile_id uuid;
BEGIN
  IF to_regclass('public.profiles') IS NULL THEN
    RAISE EXCEPTION 'Bootstrap stopped: profiles table is missing.';
  END IF;

  SELECT u.email
  INTO target_email
  FROM auth.users AS u
  WHERE u.id = target_auth_user_id
  FOR KEY SHARE;

  IF NOT FOUND OR NULLIF(BTRIM(target_email), '') IS NULL THEN
    RAISE EXCEPTION 'Bootstrap stopped: Auth user or email not found.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE auth_user_id = target_auth_user_id
  ) THEN
    RAISE EXCEPTION 'Bootstrap stopped: this user already has a profile.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE email_normalized = LOWER(BTRIM(target_email))
  ) THEN
    RAISE EXCEPTION 'Bootstrap stopped: this email already has a profile.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE is_active
      AND role IN ('admin', 'super_admin')
  ) THEN
    RAISE EXCEPTION 'Bootstrap stopped: an active administrator already exists.';
  END IF;

  INSERT INTO public.profiles (
    auth_user_id,
    email,
    role,
    first_name,
    surname,
    role_title,
    is_active,
    activated_at
  )
  VALUES (
    target_auth_user_id,
    target_email,
    'admin',
    verified_first_name,
    verified_surname,
    'Administrator',
    TRUE,
    NOW()
  )
  RETURNING id INTO new_profile_id;

  RAISE NOTICE 'Administrator profile created: %', new_profile_id;
END
$bootstrap$;

COMMIT;
