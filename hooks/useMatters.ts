'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  Matter,
  MatterWithStats,
  CreateMatterInput,
  UpdateMatterInput,
  MatterFilters,
} from '@/types/matter';

// ============================================================================
// Fetch all matters
// ============================================================================

async function fetchMatters(filters?: MatterFilters): Promise<MatterWithStats[]> {
  const params = new URLSearchParams();

  if (filters?.search) params.append('search', filters.search);
  if (filters?.status) params.append('status', filters.status);
  if (filters?.jurisdiction) params.append('jurisdiction', filters.jurisdiction);
  if (filters?.courtType) params.append('courtType', filters.courtType);

  const response = await fetch(`/api/matters?${params.toString()}`);

  if (!response.ok) {
    throw new Error('Failed to fetch matters');
  }

  const data = await response.json();
  return data.matters;
}

export function useMatters(filters?: MatterFilters) {
  return useQuery({
    queryKey: ['matters', filters],
    queryFn: () => fetchMatters(filters),
  });
}

// ============================================================================
// Fetch single matter
// ============================================================================

async function fetchMatter(id: string): Promise<any> {
  const response = await fetch(`/api/matters/${id}`);

  if (!response.ok) {
    throw new Error('Failed to fetch matter');
  }

  const data = await response.json();
  return data.matter;
}

export function useMatter(id: string) {
  return useQuery({
    queryKey: ['matter', id],
    queryFn: () => fetchMatter(id),
    enabled: !!id,
  });
}

// ============================================================================
// Create matter
// ============================================================================

async function createMatter(input: CreateMatterInput): Promise<Matter> {
  const response = await fetch('/api/matters', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create matter');
  }

  const data = await response.json();
  return data.matter;
}

export function useCreateMatter() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createMatter,
    onSuccess: () => {
      // Invalidate matters list to refetch
      queryClient.invalidateQueries({ queryKey: ['matters'] });
    },
  });
}

// ============================================================================
// Update matter
// ============================================================================

async function updateMatter({ id, data }: { id: string; data: UpdateMatterInput }): Promise<Matter> {
  const response = await fetch(`/api/matters/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to update matter');
  }

  const result = await response.json();
  return result.matter;
}

export function useUpdateMatter() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateMatter,
    onSuccess: (data) => {
      // Invalidate matters list and specific matter
      queryClient.invalidateQueries({ queryKey: ['matters'] });
      queryClient.invalidateQueries({ queryKey: ['matter', data.id] });
    },
  });
}

// ============================================================================
// Delete (archive) matter
// ============================================================================

async function deleteMatter(id: string): Promise<void> {
  const response = await fetch(`/api/matters/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to delete matter');
  }
}

export function useDeleteMatter() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteMatter,
    onSuccess: () => {
      // Invalidate matters list to refetch
      queryClient.invalidateQueries({ queryKey: ['matters'] });
    },
  });
}

// ============================================================================
// Matter statistics
// ============================================================================

export function useMatterStats(filters?: MatterFilters) {
  const { data: matters, isLoading } = useMatters(filters);

  const stats = {
    total: matters?.length || 0,
    active: matters?.filter((m) => m.status === 'active').length || 0,
    pending: matters?.filter((m) => m.status === 'pending').length || 0,
    closed: matters?.filter((m) => m.status === 'closed').length || 0,
    archived: matters?.filter((m) => m.status === 'archived').length || 0,
    totalSessions: matters?.reduce((sum, m) => sum + m._count.sessions, 0) || 0,
    totalDocuments: matters?.reduce((sum, m) => sum + m._count.documents, 0) || 0,
    totalBillableAmount: matters?.reduce((sum, m) => sum + (m.totalBillableAmount || 0), 0) || 0,
  };

  return { stats, isLoading };
}
