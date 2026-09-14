// Llama funciones de base de datos que requieren sesión vigente.
// Si la sesión expiró en silencio (token vencido), la renueva y reintenta
// una vez antes de rendirse, evitando pantallas vacías o errores de permiso.

import { supabase } from '@/integrations/supabase/client';

interface RpcErrorLike {
  code?: string;
  message?: string;
}

function isAuthOrPermissionError(error: RpcErrorLike | null): boolean {
  if (!error) return false;
  if (error.code === '42501' || error.code === 'PGRST301' || error.code === 'PGRST302') {
    return true;
  }
  return /permission denied|jwt|token|authentication/i.test(error.message ?? '');
}

export async function rpcWithAuthRetry<T = unknown>(
  fn: string,
): Promise<{ data: T | null; error: RpcErrorLike | null }> {
  // getSession renueva el token automáticamente si está por vencer
  await supabase.auth.getSession().catch(() => undefined);

  let result = (await supabase.rpc(fn)) as { data: T | null; error: RpcErrorLike | null };

  if (result.error && isAuthOrPermissionError(result.error)) {
    const { error: refreshError } = await supabase.auth
      .refreshSession()
      .catch((error) => ({ error: error as Error, data: { session: null, user: null } }));
    if (!refreshError) {
      result = (await supabase.rpc(fn)) as { data: T | null; error: RpcErrorLike | null };
    }
  }

  return result;
}
