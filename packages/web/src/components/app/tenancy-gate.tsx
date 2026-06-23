import { type ReactNode } from 'react';
import { Empty, Spinner } from '@/components/dashboard/primitives';
import { useWorkspace, type TenancyOption } from '@/lib/workspace';

/**
 * Renders tenancy-scoped page content only once a tenancy is selected.
 * Tenancy pages share the active tenancy chosen from the sidebar picker.
 */
export function TenancyGate({
  children,
}: {
  children: (ctx: { tenancyId: string; tenancy: TenancyOption; landlordId: string | null }) => ReactNode;
}) {
  const { selectedTenancyId, selectedTenancy, tenanciesLoading, landlordId } = useWorkspace();

  if (tenanciesLoading) {
    return (
      <p className="py-10 text-center text-sm text-white/40">
        <Spinner /> <span className="ml-2 align-middle">Loading tenancies…</span>
      </p>
    );
  }
  if (!selectedTenancyId || !selectedTenancy) {
    return <Empty>Select a tenancy from the sidebar — or create one under Tenancies — to continue.</Empty>;
  }
  return <>{children({ tenancyId: selectedTenancyId, tenancy: selectedTenancy, landlordId })}</>;
}
