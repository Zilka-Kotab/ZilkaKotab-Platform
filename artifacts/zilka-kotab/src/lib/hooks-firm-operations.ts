import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchPortal } from './api-portal';
import type { FirmOperations, FirmWorkflowUpdate, FirmStatusHistory, FirmCsvInput, FirmCsvResult, FirmOperationResult, FirmBillingLedger, FirmBillingInput, FirmBillingUpdate, FirmPaymentInput } from '@workspace/api-client-react';
export type { FirmWorkflowRow, FirmBillingItem, FirmBillingInput, FirmBillingUpdate, FirmPaymentInput, FirmCsvResult } from '@workspace/api-client-react';

const key = ['portal', 'firm-operations'] as const;
export function useFirmOperations() {
  return useQuery({ queryKey: key, queryFn: () => fetchPortal<FirmOperations>('/operations'), refetchOnWindowFocus: true, staleTime: 15000 });
}
export function useFirmStatusHistory(id: string, enabled: boolean) {
  return useQuery({ queryKey: [...key, 'history', id], queryFn: () => fetchPortal<FirmStatusHistory>(`/operations/rows/${id}/history`), enabled, staleTime: 15000, refetchOnWindowFocus: true });
}
export function useFirmBilling() {
  return useQuery({ queryKey: [...key, 'billing'], queryFn: () => fetchPortal<FirmBillingLedger>('/operations/billing'), refetchOnWindowFocus: true, staleTime: 15000 });
}
function useSave<T>(save: (data: T) => Promise<FirmOperationResult>) {
  const client = useQueryClient();
  return useMutation({ mutationFn: save, onSuccess: () => client.invalidateQueries({ queryKey: ['portal'] }) });
}
export function useUpdateFirmRow() {
  return useSave(({ id, data }: { id: string; data: FirmWorkflowUpdate }) =>
    fetchPortal<FirmOperationResult>(`/operations/rows/${id}`, { method: 'PATCH', body: JSON.stringify(data) }));
}
export function useImportFirmCsv() {
  const client = useQueryClient();
  return useMutation({ mutationFn: (data: FirmCsvInput) => fetchPortal<FirmCsvResult>('/operations/import', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: (result) => result.applied ? client.invalidateQueries({ queryKey: ['portal'] }) : undefined });
}
export function useCreateFirmBilling() {
  return useSave((data: FirmBillingInput) => fetchPortal<FirmOperationResult>('/operations/billing', { method: 'POST', body: JSON.stringify(data) }));
}
export function useUpdateFirmBilling() {
  return useSave(({ id, data }: { id: string; data: FirmBillingUpdate }) => fetchPortal<FirmOperationResult>(`/operations/billing/${id}`, { method: 'PATCH', body: JSON.stringify(data) }));
}
export function useRecordFirmPayment() {
  return useSave(({ id, data }: { id: string; data: FirmPaymentInput }) => fetchPortal<FirmOperationResult>(`/operations/billing/${id}/payments`, { method: 'POST', body: JSON.stringify(data) }));
}
