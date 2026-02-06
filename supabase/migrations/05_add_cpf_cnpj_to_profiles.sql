-- Add CPF/CNPJ to profiles for Asaas PIX billing
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS cpf_cnpj TEXT;

COMMENT ON COLUMN public.profiles.cpf_cnpj IS 'CPF (11 dígitos) ou CNPJ (14 dígitos) do titular para cobrança PIX via Asaas.';

