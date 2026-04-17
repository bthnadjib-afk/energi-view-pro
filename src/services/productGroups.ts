import { supabase } from '@/integrations/supabase/client';

export interface GroupLine {
  desc: string;
  qty: number;
  subprice: number;
  tva_tx: number;
  product_type: number; // 0=fourniture, 1=main d'œuvre
  prixAchat: number;
  variable_qty: boolean; // quantité à définir par l'utilisateur
}

export interface ProductGroup {
  id: string;
  nom: string;
  description: string;
  lines: GroupLine[];
  created_at: string;
  updated_at: string;
}

export type ProductGroupInput = Pick<ProductGroup, 'nom' | 'description' | 'lines'>;

export async function fetchProductGroups(): Promise<ProductGroup[]> {
  const { data, error } = await supabase
    .from('product_groups')
    .select('*')
    .order('nom');
  if (error) throw error;
  return (data || []).map(row => ({
    ...row,
    lines: Array.isArray(row.lines) ? row.lines : [],
  })) as ProductGroup[];
}

export async function createProductGroup(input: ProductGroupInput): Promise<ProductGroup> {
  const { data, error } = await supabase
    .from('product_groups')
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return { ...data, lines: Array.isArray(data.lines) ? data.lines : [] } as ProductGroup;
}

export async function updateProductGroup(id: string, input: ProductGroupInput): Promise<ProductGroup> {
  const { data, error } = await supabase
    .from('product_groups')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return { ...data, lines: Array.isArray(data.lines) ? data.lines : [] } as ProductGroup;
}

export async function deleteProductGroup(id: string): Promise<void> {
  const { error } = await supabase
    .from('product_groups')
    .delete()
    .eq('id', id);
  if (error) throw error;
}
