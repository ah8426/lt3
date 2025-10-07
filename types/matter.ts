// Matter (Case) Management Types

export type MatterStatus = 'active' | 'archived' | 'closed' | 'pending';

export type Jurisdiction = 'michigan' | 'federal' | 'other';

export type CourtType = 'circuit' | 'district' | 'probate' | 'appeals' | 'bankruptcy' | 'family' | 'other';

export interface Matter {
  id: string;
  name: string;
  clientName: string;
  adverseParty: string | null;
  jurisdiction: Jurisdiction | null;
  courtType: CourtType | null;
  caseNumber: string | null;
  status: MatterStatus;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface MatterWithStats extends Matter {
  _count: {
    sessions: number;
    documents: number;
    billableTime: number;
  };
  totalBillableAmount?: number;
  totalDuration?: number;
}

export interface CreateMatterInput {
  name: string;
  clientName: string;
  adverseParty?: string;
  jurisdiction?: Jurisdiction;
  courtType?: CourtType;
  caseNumber?: string;
}

export interface UpdateMatterInput {
  name?: string;
  clientName?: string;
  adverseParty?: string;
  jurisdiction?: Jurisdiction;
  courtType?: CourtType;
  caseNumber?: string;
  status?: MatterStatus;
}

export interface MatterFilters {
  search?: string;
  status?: MatterStatus;
  jurisdiction?: Jurisdiction;
  courtType?: CourtType;
}

export const JURISDICTIONS: Record<Jurisdiction, string> = {
  michigan: 'Michigan',
  federal: 'Federal',
  other: 'Other',
};

export const COURT_TYPES: Record<CourtType, string> = {
  circuit: 'Circuit Court',
  district: 'District Court',
  probate: 'Probate Court',
  appeals: 'Court of Appeals',
  bankruptcy: 'Bankruptcy Court',
  family: 'Family Court',
  other: 'Other',
};

export const MATTER_STATUSES: Record<MatterStatus, { label: string; color: string }> = {
  active: { label: 'Active', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' },
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' },
  closed: { label: 'Closed', color: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400' },
  archived: { label: 'Archived', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' },
};
