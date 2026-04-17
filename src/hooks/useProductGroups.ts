import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchProductGroups, createProductGroup, updateProductGroup, deleteProductGroup,
  type ProductGroupInput,
} from '@/services/productGroups';
import { toast } from 'sonner';

export function useProductGroups() {
  return useQuery({ queryKey: ['product_groups'], queryFn: fetchProductGroups });
}

export function useCreateProductGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ProductGroupInput) => createProductGroup(data),
    onSuccess: () => { toast.success('Lot créé'); qc.invalidateQueries({ queryKey: ['product_groups'] }); },
    onError: (e: any) => toast.error(`Erreur : ${e.message || e}`),
  });
}

export function useUpdateProductGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: ProductGroupInput & { id: string }) => updateProductGroup(id, data),
    onSuccess: () => { toast.success('Lot modifié'); qc.invalidateQueries({ queryKey: ['product_groups'] }); },
    onError: (e: any) => toast.error(`Erreur : ${e.message || e}`),
  });
}

export function useDeleteProductGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteProductGroup(id),
    onSuccess: () => { toast.success('Lot supprimé'); qc.invalidateQueries({ queryKey: ['product_groups'] }); },
    onError: (e: any) => toast.error(`Erreur : ${e.message || e}`),
  });
}
