import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useWallet } from "@/hooks/useWallet";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getEdgeFunctionAuthHeaders } from "@/lib/edgeFunctionAuth";
import Sidebar from "@/components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Wallet as WalletIcon, ArrowDownCircle, ArrowUpCircle, Copy, Loader2 } from "lucide-react";

const Wallet = () => {
  const { user, loading: authLoading } = useAuth();
  const {
    balance_available,
    balance_locked,
    pending_withdrawals_sum,
    total,
    pendingWithdrawals,
    loading: walletLoading,
    refetch,
  } = useWallet();
  const { toast } = useToast();
  const [depositOpen, setDepositOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [pixKey, setPixKey] = useState("");
  const [pixKeyType, setPixKeyType] = useState("EVP");
  const [depositLoading, setDepositLoading] = useState(false);
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [depositResult, setDepositResult] = useState<{
    qrCodeBase64: string;
    payload: string;
    paymentId: string;
  } | null>(null);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  const handleDeposit = async () => {
    const amount = parseFloat(depositAmount.replace(",", "."));
    if (isNaN(amount) || amount < 5 || amount > 5000) {
      toast({
        variant: "destructive",
        title: "Valor inválido",
        description: "Depósito deve ser entre R$ 5,00 e R$ 5.000,00.",
      });
      return;
    }
    setDepositLoading(true);
    setDepositResult(null);
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.refreshSession();
      if (sessionError || !session?.access_token) {
        toast({
          variant: "destructive",
          title: "Sessão inválida",
          description: "Faça login novamente para continuar.",
        });
        setDepositLoading(false);
        return;
      }
      const { data, error } = await supabase.functions.invoke("create-pix-deposit", {
        body: { amount },
        headers: getEdgeFunctionAuthHeaders(session),
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setDepositResult({
        qrCodeBase64: data.qrCodeBase64,
        payload: data.payload,
        paymentId: data.paymentId,
      });
      refetch();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Erro ao criar depósito";
      toast({
        variant: "destructive",
        title: "Erro",
        description: message,
      });
    } finally {
      setDepositLoading(false);
    }
  };

  const copyPayload = () => {
    if (depositResult?.payload) {
      navigator.clipboard.writeText(depositResult.payload);
      toast({ title: "Copiado!", description: "Código PIX copia e cola copiado." });
    }
  };

  const handleWithdraw = async () => {
    const amount = parseFloat(withdrawAmount.replace(",", "."));
    if (isNaN(amount) || amount < 10 || amount > 10000) {
      toast({
        variant: "destructive",
        title: "Valor inválido",
        description: "Saque deve ser entre R$ 10,00 e R$ 10.000,00.",
      });
      return;
    }
    if (amount > balance_available) {
      toast({
        variant: "destructive",
        title: "Saldo insuficiente",
        description: "Você não tem saldo disponível para este valor.",
      });
      return;
    }
    if (!pixKey.trim()) {
      toast({
        variant: "destructive",
        title: "Chave PIX obrigatória",
        description: "Informe sua chave PIX para saque.",
      });
      return;
    }
    setWithdrawLoading(true);
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.refreshSession();
      if (sessionError || !session?.access_token) {
        toast({
          variant: "destructive",
          title: "Sessão inválida",
          description: "Faça login novamente para continuar.",
        });
        setWithdrawLoading(false);
        return;
      }
      const { data, error } = await supabase.functions.invoke("request-withdrawal", {
        body: { amount, pixKey: pixKey.trim(), pixKeyType },
        headers: getEdgeFunctionAuthHeaders(session),
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({
        title: "Saque solicitado",
        description: `Processamento em até 24h. Data prevista: ${data.scheduledAfter ? new Date(data.scheduledAfter).toLocaleString("pt-BR") : "-"}`,
      });
      setWithdrawOpen(false);
      setWithdrawAmount("");
      setPixKey("");
      refetch();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Erro ao solicitar saque";
      toast({
        variant: "destructive",
        title: "Erro",
        description: message,
      });
    } finally {
      setWithdrawLoading(false);
    }
  };

  const formatBRL = (n: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar activeTab="wallet" onTabChange={() => {}} />
      <main className="flex-1 p-6 overflow-auto">
        <div className="max-w-2xl mx-auto space-y-6">
          <div>
            <h1 className="font-display font-bold text-3xl mb-2">Minha Carteira</h1>
            <p className="text-muted-foreground">Saldo, depósitos e saques via PIX</p>
          </div>

          {walletLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <>
              <Card className="border-border bg-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <WalletIcon className="w-5 h-5" />
                    Resumo
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center py-2 border-b border-border">
                    <span className="text-muted-foreground">Saldo disponível</span>
                    <span className="font-mono font-semibold text-lg">{formatBRL(balance_available)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-border">
                    <span className="text-muted-foreground">Em jogo</span>
                    <span className="font-mono">{formatBRL(balance_locked)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-border">
                    <span className="text-muted-foreground">Saques pendentes</span>
                    <span className="font-mono">{formatBRL(pending_withdrawals_sum)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 pt-4">
                    <span className="font-medium">Total</span>
                    <span className="font-mono font-semibold text-xl">{formatBRL(total)}</span>
                  </div>
                </CardContent>
              </Card>

              <div className="flex gap-4">
                <Button
                  className="flex-1 gap-2"
                  size="lg"
                  onClick={() => {
                    setDepositResult(null);
                    setDepositAmount("");
                    setDepositOpen(true);
                  }}
                >
                  <ArrowDownCircle className="w-5 h-5" />
                  Depositar
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 gap-2"
                  size="lg"
                  onClick={() => {
                    setWithdrawAmount("");
                    setPixKey("");
                    setWithdrawOpen(true);
                  }}
                >
                  <ArrowUpCircle className="w-5 h-5" />
                  Sacar
                </Button>
              </div>

              {pendingWithdrawals.length > 0 && (
                <Card className="border-border bg-card">
                  <CardHeader>
                    <CardTitle>Saques pendentes</CardTitle>
                    <CardDescription>Estes saques serão processados em até 24h</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {pendingWithdrawals.map((w) => (
                        <li
                          key={w.id}
                          className="flex justify-between items-center py-2 border-b border-border last:border-0"
                        >
                          <span className="font-mono">{formatBRL(w.amount)}</span>
                          <span className="text-sm text-muted-foreground">
                            {new Date(w.scheduled_after).toLocaleString("pt-BR")} • {w.status}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      </main>

      <Dialog open={depositOpen} onOpenChange={setDepositOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Depositar via PIX</DialogTitle>
            <DialogDescription>
              Valor entre R$ 5,00 e R$ 5.000,00. Escaneie o QR Code ou use o código copia e cola.
            </DialogDescription>
          </DialogHeader>
          {!depositResult ? (
            <div className="space-y-4">
              <div>
                <Label htmlFor="deposit-amount">Valor (R$)</Label>
                <Input
                  id="deposit-amount"
                  type="number"
                  min={5}
                  max={5000}
                  step={0.01}
                  placeholder="100,00"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                />
              </div>
              <Button className="w-full" onClick={handleDeposit} disabled={depositLoading}>
                {depositLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Gerando...
                  </>
                ) : (
                  "Gerar QR Code PIX"
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Aguardando confirmação do pagamento.</p>
              {depositResult.qrCodeBase64 && (
                <div className="flex justify-center p-4 bg-muted rounded-lg">
                  <img
                    src={`data:image/png;base64,${depositResult.qrCodeBase64}`}
                    alt="QR Code PIX"
                    className="w-48 h-48"
                  />
                </div>
              )}
              <div className="flex gap-2">
                <Input readOnly value={depositResult.payload} className="font-mono text-xs" />
                <Button variant="outline" size="icon" onClick={copyPayload}>
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
              <Button variant="outline" className="w-full" onClick={() => setDepositOpen(false)}>
                Fechar
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Sacar via PIX</DialogTitle>
            <DialogDescription>
              Valor entre R$ 10,00 e R$ 10.000,00. Processamento em até 24h.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="withdraw-amount">Valor (R$)</Label>
              <Input
                id="withdraw-amount"
                type="number"
                min={10}
                max={10000}
                step={0.01}
                placeholder="50,00"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
              />
            </div>
            <div>
              <Label>Tipo de chave PIX</Label>
              <select
                className="w-full mt-2 h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={pixKeyType}
                onChange={(e) => setPixKeyType(e.target.value)}
              >
                <option value="EVP">Chave aleatória (EVP)</option>
                <option value="CPF">CPF</option>
                <option value="CNPJ">CNPJ</option>
                <option value="EMAIL">E-mail</option>
                <option value="PHONE">Telefone</option>
              </select>
            </div>
            <div>
              <Label htmlFor="pix-key">Chave PIX</Label>
              <Input
                id="pix-key"
                type="text"
                placeholder={pixKeyType === "CPF" ? "000.000.000-00" : "Sua chave"}
                value={pixKey}
                onChange={(e) => setPixKey(e.target.value)}
              />
            </div>
            <Button className="w-full" onClick={handleWithdraw} disabled={withdrawLoading}>
              {withdrawLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Solicitando...
                </>
              ) : (
                "Solicitar saque"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Wallet;
