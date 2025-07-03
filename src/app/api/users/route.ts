import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { UserService } from '@/lib/services/user-service';
import type { UserRole } from '@/types';

/**
 * POST /api/users - Create a new user in the database
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const supabase = await createClient();
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { name, role, avatar } = body;

    // Validate required fields
    if (!name || !role) {
      return NextResponse.json(
        { error: 'Name and role are required' },
        { status: 400 }
      );
    }

    // Validate role
    if (!['INSTRUCTOR', 'LEARNER'].includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role. Must be INSTRUCTOR or LEARNER' },
        { status: 400 }
      );
    }

    // Check if user already exists in database
    const existingUser = await UserService.getUserById(authUser.id);
    if (existingUser) {
      return NextResponse.json(
        { error: 'User already exists' },
        { status: 409 }
      );
    }

    // Create user in database
    const user = await UserService.createUser({
      id: authUser.id,
      email: authUser.email!,
      name,
      role: role as UserRole,
      avatar,
    });

    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/users - Get current user data
 */
export async function GET() {
  try {
    // Verify authentication
    const supabase = await createClient();
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user from database
    const user = await UserService.getUserById(authUser.id);
    
    if (!user) {
      return NextResponse.json(
        { error: 'User not found in database' },
        { status: 404 }
      );
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/users - Update current user data
 */
export async function PUT(request: NextRequest) {
  try {
    // Verify authentication
    const supabase = await createClient();
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();

    if (authError || !authUser) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { name, role, avatar, preferences } = body;

    // Validate role if provided
    if (role && !['INSTRUCTOR', 'LEARNER'].includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role. Must be INSTRUCTOR or LEARNER' },
        { status: 400 }
      );
    }

    // Update user in database
    const user = await UserService.updateUser(authUser.id, {
      name,
      role: role as UserRole,
      avatar,
      preferences,
    });

    return NextResponse.json({ user });
  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
