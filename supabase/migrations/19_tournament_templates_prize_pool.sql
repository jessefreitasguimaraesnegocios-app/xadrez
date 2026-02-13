-- Valor do prêmio do torneio (usado ao gerar torneios a partir do template)
ALTER TABLE public.tournament_templates
  ADD COLUMN IF NOT EXISTS prize_pool DECIMAL(10,2) DEFAULT 0 NOT NULL;

COMMENT ON COLUMN public.tournament_templates.prize_pool IS 'Valor do prêmio exibido no torneio (R$). Usado ao gerar torneios a partir do template.';
