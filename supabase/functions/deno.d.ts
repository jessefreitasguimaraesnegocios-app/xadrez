/**
 * Declarações para o IDE: Edge Functions rodam em Deno no deploy.
 * Evita erros "Cannot find name 'Deno'" e "Cannot find module 'npm:@supabase/supabase-js@2'".
 */

declare global {
  const Deno: {
    serve: (handler: (req: Request) => Response | Promise<Response>) => unknown;
    env: {
      get: (key: string) => string | undefined;
    };
  };
}

declare module "npm:@supabase/supabase-js@2" {
  export function createClient(
    url: string,
    key: string,
    options?: { global?: { headers?: { Authorization?: string } } }
  ): {
    auth: { getUser: () => Promise<{ data: { user: unknown }; error: unknown }> };
    from: (table: string) => unknown;
    rpc: (fn: string, params: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
  };
}

export {};
