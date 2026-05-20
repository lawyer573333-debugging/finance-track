import { supabase } from '../lib/supabase';

export interface UserProfile {
  id?: string;
  name: string;
  email: string;
  created_at?: string;
}

/**
 * Creates a new user profile in the Supabase 'users' table.
 * @param name Full name of the user
 * @param email Email of the user
 * @returns The newly created user or null if an error occurred
 */
export async function createUser(name: string, email: string): Promise<UserProfile | null> {
  try {
    const { data, error } = await supabase
      .from('users')
      .insert([{ name, email }])
      .select()
      .single();

    if (error) {
      console.error('Error in createUser service:', error.message);
      throw error;
    }

    return data as UserProfile;
  } catch (err) {
    console.error('Failed to create user:', err);
    return null;
  }
}

/**
 * Fetches all user profiles from the Supabase 'users' table.
 * @returns List of user profiles or an empty array if an error occurred
 */
export async function getUsers(): Promise<UserProfile[]> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error in getUsers service:', error.message);
      throw error;
    }

    return (data || []) as UserProfile[];
  } catch (err) {
    console.error('Failed to get users:', err);
    return [];
  }
}
