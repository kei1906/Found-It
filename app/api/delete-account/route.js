import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

export async function DELETE(request) {
  try {
    // 1. Verify the requesting user is actually authenticated
    //    Use anon client to validate the JWT from the Authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const anonClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    const { data: { user }, error: authError } = await anonClient.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const adminClient = getSupabaseAdmin();
    const userId = user.id;

    // 2. Delete user's items from storage + DB (storage objects)
    //    First get their image file names
    const { data: userItems } = await adminClient
      .from('items')
      .select('image_url')
      .eq('user_id', userId);

    // 3. Delete items from DB (cascade should handle related records)
    await adminClient.from('items').delete().eq('user_id', userId);

    // 4. Delete profile row
    await adminClient.from('profiles').delete().eq('id', userId);

    // 5. Delete the auth user (the important part the client-side can't do)
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);
    if (deleteError) throw deleteError;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete account error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
