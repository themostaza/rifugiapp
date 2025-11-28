import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

/**
 * Check if the current user has maintenance bypass access
 */
export async function GET() {
  // If maintenance mode is not enabled, everyone is allowed
  if (process.env.MAINTENANCE_MODE !== 'true') {
    return NextResponse.json({ allowed: true, reason: 'maintenance_disabled' });
  }

  // Check for bypass cookie
  const cookieStore = await cookies();
  const bypassCookie = cookieStore.get('maintenance_bypass');

  if (bypassCookie?.value === process.env.MAINTENANCE_BYPASS_TOKEN) {
    return NextResponse.json({ allowed: true, reason: 'valid_cookie' });
  }

  return NextResponse.json({ allowed: false });
}

