import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

/**
 * Verify maintenance password and set bypass cookie
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { password } = body;

    const correctPassword = process.env.MAINTENANCE_PASSWORD;

    if (!correctPassword) {
      console.error('[Maintenance] MAINTENANCE_PASSWORD not configured');
      return NextResponse.json({ success: false, error: 'Not configured' }, { status: 500 });
    }

    if (password !== correctPassword) {
      return NextResponse.json({ success: false, error: 'Invalid password' });
    }

    // Generate or use existing bypass token
    const bypassToken = process.env.MAINTENANCE_BYPASS_TOKEN || 
      `bypass_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Set cookie (valid for 7 days)
    const cookieStore = await cookies();
    cookieStore.set('maintenance_bypass', bypassToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('[Maintenance] Error verifying password:', error);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}

