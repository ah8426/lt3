import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { AuditAction, AuditResource, AuditLogFilter, AuditLogResponse } from '@/types/audit';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse query parameters
    const { searchParams } = request.nextUrl;
    const userId = searchParams.get('userId') || user.id;
    const action = searchParams.get('action');
    const resource = searchParams.get('resource');
    const resourceId = searchParams.get('resourceId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    // Users can only view their own logs (unless admin role is added in future)
    if (userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Build query
    let query = supabase
      .from('audit_logs')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    // Apply filters
    if (action) {
      const actions = action.split(',') as AuditAction[];
      if (actions.length === 1) {
        query = query.eq('action', actions[0]);
      } else {
        query = query.in('action', actions);
      }
    }

    if (resource) {
      const resources = resource.split(',') as AuditResource[];
      if (resources.length === 1) {
        query = query.eq('resource', resources[0]);
      } else {
        query = query.in('resource', resources);
      }
    }

    if (resourceId) {
      query = query.eq('resource_id', resourceId);
    }

    if (startDate) {
      query = query.gte('created_at', new Date(startDate).toISOString());
    }

    if (endDate) {
      query = query.lte('created_at', new Date(endDate).toISOString());
    }

    // Apply pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching audit logs:', error);
      return NextResponse.json({ error: 'Failed to fetch audit logs' }, { status: 500 });
    }

    // Transform data to match AuditLog interface
    const logs = (data || []).map((log: any) => ({
      id: log.id,
      userId: log.user_id,
      action: log.action as AuditAction,
      resource: log.resource as AuditResource,
      resourceId: log.resource_id,
      metadata: log.metadata,
      ipAddress: log.ip_address,
      userAgent: log.user_agent,
      location: log.location,
      timestamp: new Date(log.created_at),
      retentionUntil: log.retention_until ? new Date(log.retention_until) : undefined,
    }));

    const total = count || 0;
    const totalPages = Math.ceil(total / limit);

    const response: AuditLogResponse = {
      logs,
      total,
      page,
      limit,
      totalPages,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in audit logs API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
