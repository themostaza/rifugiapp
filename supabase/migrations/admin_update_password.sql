-- This SQL function should be executed in the Supabase SQL editor
-- It creates a secure RPC function for admin to update user passwords

-- Create or replace the function
CREATE OR REPLACE FUNCTION admin_update_user_password(user_id UUID, new_password TEXT)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with the privileges of the function creator
SET search_path = public
AS $$
DECLARE
  requesting_user_id UUID;
  is_admin BOOLEAN;
  result json;
BEGIN
  -- Get the ID of the user making the request
  requesting_user_id := auth.uid();
  
  -- Check if requesting user exists and is an admin
  SELECT p.is_admin INTO is_admin
  FROM profiles p
  WHERE p.id = requesting_user_id;
  
  -- Validate admin status
  IF is_admin IS NOT TRUE THEN
    RETURN json_build_object('success', false, 'error', 'Richiede privilegi amministrativi');
  END IF;
  
  -- Update the user's password
  -- This leverages the built-in Supabase function to properly hash passwords
  PERFORM auth.update_user(
    user_id,
    json_build_object('password', new_password)
  );
  
  RETURN json_build_object('success', true);
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Grant execution permission to authenticated users
GRANT EXECUTE ON FUNCTION admin_update_user_password(UUID, TEXT) TO authenticated;

-- Note: You need to ensure a "profiles" table exists with an "is_admin" column
-- Example create statement for reference:
/*
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
*/ 