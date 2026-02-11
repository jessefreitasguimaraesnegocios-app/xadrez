# Erros de Realtime e Auth na partida online

Se ao estar numa partida com amigo aparecem no console:

- **WebSocket connection to 'wss://...supabase.co/realtime/v1/websocket...' failed**
- **403** em `/auth/v1/logout?scope=global`
- **400** em `/auth/v1/token?grant_type=password`

Segue o que cada um costuma ser e o que conferir.

---

## 1. WebSocket (Realtime) falhou

**O que é:** A conexão em tempo real com o Supabase (para ver a jogada do amigo na hora) não conseguiu abrir ou caiu.

**O que fazer:**

1. **Dashboard do Supabase**
   - Em **Project Settings → API**: confirme que a URL e a anon key são as mesmas do seu `.env` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`).
   - Em **Database → Replication**: a tabela `games` deve estar na publicação do Realtime (geralmente já fica ao criar a tabela com realtime habilitado).

2. **Rede**
   - Teste em outra rede (outro Wi‑Fi ou 4G).
   - Redes corporativas ou com firewall podem bloquear `wss://`. Se for o caso, liberar o domínio do Supabase para WebSocket.

3. **Navegador**
   - Testar em aba anônima ou outro navegador (sem extensões que bloqueiam conexões).

4. **Limite de conexões**
   - No plano gratuito do Supabase há limite de conexões Realtime. Muitas abas ou muitos usuários ao mesmo tempo podem fazer o WebSocket falhar; nesse caso a conexão pode voltar sozinha depois.

Enquanto o WebSocket estiver falhando, a partida pode abrir e o tabuleiro/tempo aparecerem, mas **as jogadas do outro jogador não atualizam em tempo real** (só ao recarregar ou quando a conexão voltar).

---

## 2. 403 em logout

**O que é:** A requisição de logout foi rejeitada (proibido).

**O que fazer:**

- Pode ser sessão já inválida ou expirada (ex.: depois de muito tempo ou após o refresh do token falhar).
- Não costuma impedir de continuar jogando; o app pode seguir usando a sessão atual até dar refresh ou você fazer login de novo.
- Se quiser, ao receber 403 em logout, tratar como “sessão já encerrada” e só redirecionar para login sem mostrar erro crítico.

---

## 3. 400 em token com grant_type=password

**O que é:** Algo pediu um token usando “senha” (login por email/senha) e o servidor respondeu com “requisição inválida” (400).

**O que fazer:**

- Pode ser **refresh de sessão** em momento em que a sessão já expirou ou está inválida.
- Ou algum fluxo (ex.: restauração de sessão ao abrir a partida) tentando usar “password” com dados incorretos.
- Em geral o app continua usando a sessão que já está em memória; o 400 costuma aparecer em segundo plano.
- Se o usuário for deslogado sem motivo, vale revisar no código onde se chama `signIn`/`refreshSession`/`getSession` ao abrir a partida ou ao receber erros de auth.

---

## Resumo

| Erro              | Impacto provável                    | Ação rápida                          |
|-------------------|-------------------------------------|--------------------------------------|
| WebSocket failed  | Jogadas do amigo não atualizam ao vivo | Ver rede, outra aba, Dashboard Supabase |
| 403 logout        | Só mensagem no console              | Pode ignorar ou tratar como sessão inválida |
| 400 token password| Só mensagem no console ou logout inesperado | Ver fluxos de login/refresh ao abrir partida |

Para a **partida em si**, o mais importante é o **WebSocket**: enquanto ele falhar, o Realtime não funciona; o resto da partida (tabuleiro, tempo, uma jogada por vez) pode seguir funcionando com refresh manual da página ou quando a conexão voltar.
