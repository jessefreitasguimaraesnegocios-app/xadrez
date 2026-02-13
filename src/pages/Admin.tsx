import { useState, useEffect, useCallback } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { invokeEdgeFunction } from "@/lib/edgeFunctionAuth";
import Sidebar from "@/components/Sidebar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Shield, BarChart3, Trophy, Loader2, Plus, Pencil, Trash2, Calendar } from "lucide-react";

type ReportItem = {
  game_id: string;
  bet_amount: number;
  pot: number;
  platform_fee: number;
  result: string | null;
  ended_at: string | null;
};

type ReportData = {
  total_revenue: number;
  count: number;
  items: ReportItem[];
};

type TournamentTemplate = {
  id: string;
  name: string;
  description: string | null;
  format: string;
  max_participants: number;
  entry_fee: number;
  platform_fee_pct: number;
  prize_pool?: number;
  time_control: string;
  times_per_day: number;
  time_slots: string[];
  duration_minutes: number | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

const formatLabels: Record<string, string> = {
  swiss: "Suíço",
  knockout: "Eliminação",
  round_robin: "Round Robin",
};

const Admin = () => {
  const { user, profile, session, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("report");
  const [report, setReport] = useState<ReportData | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const today = () => new Date().toISOString().slice(0, 10);
  const [reportFrom, setReportFrom] = useState(() => today());
  const [reportTo, setReportTo] = useState(() => today());
  const [templates, setTemplates] = useState<TournamentTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [generateDays, setGenerateDays] = useState(7);
  const [generateLoading, setGenerateLoading] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<TournamentTemplate | null>(null);
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formFormat, setFormFormat] = useState("swiss");
  const [formMaxParticipants, setFormMaxParticipants] = useState(32);
  const [formEntryFee, setFormEntryFee] = useState("0");
  const [formPlatformFeePct, setFormPlatformFeePct] = useState("10");
  const [formPrizePool, setFormPrizePool] = useState("0");
  const [formTimeControl, setFormTimeControl] = useState("10+0");
  const [formTimesPerDay, setFormTimesPerDay] = useState(1);
  const [formTimeSlots, setFormTimeSlots] = useState("20:00");
  const [formDurationMinutes, setFormDurationMinutes] = useState("");
  const [formActive, setFormActive] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchReport = useCallback(async () => {
    if (!session?.access_token) return;
    setReportLoading(true);
    const body: Record<string, string> = {};
    if (reportFrom.trim()) body.from = reportFrom.trim();
    if (reportTo.trim()) body.to = reportTo.trim();
    const { data, error } = await invokeEdgeFunction<ReportData>(
      { access_token: session.access_token },
      "admin-report",
      body
    );
    setReportLoading(false);
    if (error) {
      toast({ variant: "destructive", title: "Erro ao carregar relatório", description: error.message });
      return;
    }
    if (data) setReport(data);
  }, [session?.access_token, reportFrom, reportTo, toast]);

  useEffect(() => {
    if (activeTab === "report" && session?.access_token) fetchReport();
  }, [activeTab, session?.access_token, fetchReport]);

  const fetchTemplates = useCallback(async () => {
    if (!session?.access_token) return;
    setTemplatesLoading(true);
    const { data, error } = await invokeEdgeFunction<{ templates: TournamentTemplate[] }>(
      { access_token: session.access_token },
      "admin-tournaments",
      { action: "list" }
    );
    setTemplatesLoading(false);
    if (error) {
      toast({ variant: "destructive", title: "Erro ao carregar templates", description: error.message });
      return;
    }
    if (data?.templates) setTemplates(data.templates);
  }, [session?.access_token, toast]);

  useEffect(() => {
    if (activeTab === "report" && session?.access_token) fetchReport();
  }, [activeTab, session?.access_token, fetchReport]);

  useEffect(() => {
    if (activeTab === "tournaments" && session?.access_token) fetchTemplates();
  }, [activeTab, session?.access_token, fetchTemplates]);

  const handleGenerateTournaments = async () => {
    if (!session?.access_token) return;
    setGenerateLoading(true);
    const { data, error } = await invokeEdgeFunction<{ generated?: number; error?: string }>(
      { access_token: session.access_token },
      "admin-tournaments",
      { action: "generate", daysAhead: generateDays }
    );
    setGenerateLoading(false);
    if (error || data?.error) {
      toast({ variant: "destructive", title: "Erro ao gerar torneios", description: data?.error ?? error?.message });
      return;
    }
    toast({ title: "Torneios gerados", description: `${data?.generated ?? 0} torneio(s) criado(s). Eles já aparecem na aba Torneios (menu lateral) para os jogadores se inscreverem.` });
    fetchTemplates();
    window.dispatchEvent(new Event("tournaments-generated"));
  };

  const openNewTemplate = () => {
    setEditingTemplate(null);
    setFormName("");
    setFormDescription("");
    setFormFormat("swiss");
    setFormMaxParticipants(32);
    setFormEntryFee("0");
    setFormPlatformFeePct("10");
    setFormPrizePool("0");
    setFormTimeControl("10+0");
    setFormTimesPerDay(1);
    setFormTimeSlots("20:00");
    setFormDurationMinutes("");
    setFormActive(true);
    setTemplateDialogOpen(true);
  };

  const openEditTemplate = (t: TournamentTemplate) => {
    setEditingTemplate(t);
    setFormName(t.name);
    setFormDescription(t.description ?? "");
    setFormFormat(t.format);
    setFormMaxParticipants(t.max_participants);
    setFormEntryFee(String(t.entry_fee));
    setFormPlatformFeePct(String(t.platform_fee_pct));
    setFormPrizePool(String(t.prize_pool ?? 0));
    setFormTimeControl(t.time_control);
    setFormTimesPerDay(t.times_per_day);
    setFormTimeSlots(Array.isArray(t.time_slots) ? t.time_slots.join(", ") : "20:00");
    setFormDurationMinutes(t.duration_minutes != null ? String(t.duration_minutes) : "");
    setFormActive(t.active);
    setTemplateDialogOpen(true);
  };

  const saveTemplate = async () => {
    if (!session?.access_token || !formName.trim()) return;
    setSaveLoading(true);
    const slots = formTimeSlots.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
    if (slots.length === 0) slots.push("20:00");
    const payload: Record<string, unknown> = {
      action: editingTemplate ? "update" : "create",
      name: formName.trim(),
      description: formDescription.trim() || null,
      format: formFormat,
      max_participants: formMaxParticipants,
      entry_fee: parseFloat(formEntryFee) || 0,
      platform_fee_pct: parseFloat(formPlatformFeePct) || 10,
      prize_pool: parseFloat(formPrizePool) || 0,
      time_control: formTimeControl,
      times_per_day: formTimesPerDay,
      time_slots: slots,
      duration_minutes: formDurationMinutes ? parseInt(formDurationMinutes, 10) : null,
      active: formActive,
    };
    if (editingTemplate?.id) payload.id = editingTemplate.id;
    const { data, error } = await invokeEdgeFunction(
      { access_token: session.access_token },
      "admin-tournaments",
      payload
    );
    setSaveLoading(false);
    if (error || data?.error) {
      toast({ variant: "destructive", title: "Erro ao salvar", description: (data as { error?: string })?.error ?? error?.message });
      return;
    }
    toast({ title: editingTemplate ? "Template atualizado" : "Template criado" });
    setTemplateDialogOpen(false);
    fetchTemplates();
  };

  const deleteTemplate = async (id: string) => {
    if (!session?.access_token) return;
    setDeletingId(id);
    const { error } = await invokeEdgeFunction(
      { access_token: session.access_token },
      "admin-tournaments",
      { action: "delete", id }
    );
    setDeletingId(null);
    if (error) {
      toast({ variant: "destructive", title: "Erro ao excluir", description: error.message });
      return;
    }
    toast({ title: "Template excluído" });
    fetchTemplates();
  };

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

  if (!profile?.is_admin) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar activeTab="" onTabChange={() => {}} />
      <main className="flex-1 p-6 overflow-auto">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center gap-2">
            <Shield className="w-8 h-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Administração</h1>
              <p className="text-sm text-muted-foreground">Relatório financeiro e programação de torneios</p>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="report" className="gap-2">
                <BarChart3 className="w-4 h-4" />
                Relatório
              </TabsTrigger>
              <TabsTrigger value="tournaments" className="gap-2">
                <Trophy className="w-4 h-4" />
                Torneios
              </TabsTrigger>
            </TabsList>

            <TabsContent value="report" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Sua receita (20% das apostas)</CardTitle>
                  <CardDescription>Partidas finalizadas com aposta em que houve ganhador</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2 items-end">
                    <div className="grid gap-1">
                      <Label>De (data)</Label>
                      <Input
                        type="date"
                        value={reportFrom}
                        onChange={(e) => setReportFrom(e.target.value)}
                        className="w-40"
                      />
                    </div>
                    <div className="grid gap-1">
                      <Label>Até (data)</Label>
                      <Input
                        type="date"
                        value={reportTo}
                        onChange={(e) => setReportTo(e.target.value)}
                        className="w-40"
                      />
                    </div>
                    <Button onClick={fetchReport} disabled={reportLoading}>
                      {reportLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Atualizar"}
                    </Button>
                  </div>
                  {reportLoading && !report && (
                    <div className="flex justify-center py-8">
                      <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                    </div>
                  )}
                  {report && !reportLoading && (
                    <>
                      <div className="text-3xl font-bold text-primary">
                        Total: R$ {report.total_revenue.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      <p className="text-sm text-muted-foreground">{report.count} partida(s) com aposta no período</p>
                      {report.items.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4 border rounded-md text-center">Nenhuma partida com aposta finalizada no período selecionado.</p>
                      ) : (
                        <div className="rounded-md border overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b bg-muted/50">
                                <th className="text-left p-2">Data</th>
                                <th className="text-right p-2">Pote</th>
                                <th className="text-right p-2">Sua taxa (20%)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {report.items.map((row) => (
                                <tr key={row.game_id} className="border-b">
                                  <td className="p-2">
                                    {row.ended_at
                                      ? new Date(row.ended_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
                                      : "—"}
                                  </td>
                                  <td className="text-right p-2">R$ {row.pot.toFixed(2)}</td>
                                  <td className="text-right p-2 font-medium">R$ {row.platform_fee.toFixed(2)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="tournaments" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Gerar torneios automaticamente</CardTitle>
                  <CardDescription>
                    Os templates abaixo <strong>não aparecem</strong> para os jogadores. É preciso clicar em &quot;Gerar torneios&quot; para criar os torneios que aparecem na aba <strong>Torneios</strong> (menu lateral). Cada template ativo será usado nos horários configurados.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2 items-center">
                    <Label>Gerar para os próximos</Label>
                    <Input
                      type="number"
                      min={1}
                      max={30}
                      value={generateDays}
                      onChange={(e) => setGenerateDays(parseInt(e.target.value, 10) || 7)}
                      className="w-20"
                    />
                    <span>dias</span>
                    <Button onClick={handleGenerateTournaments} disabled={generateLoading || templates.length === 0}>
                      {generateLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />}
                      Gerar torneios
                    </Button>
                  </div>
                  {templates.length === 0 && !templatesLoading && (
                    <p className="text-sm text-muted-foreground">Crie pelo menos um template abaixo para gerar torneios.</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Templates de torneio</CardTitle>
                    <CardDescription>Configure nome, jogadores, valor de entrada, sua taxa e horários por dia</CardDescription>
                  </div>
                  <Button onClick={openNewTemplate}>
                    <Plus className="w-4 h-4 mr-2" />
                    Novo template
                  </Button>
                </CardHeader>
                <CardContent>
                  {templatesLoading && (
                    <div className="flex justify-center py-8">
                      <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                    </div>
                  )}
                  {!templatesLoading && templates.length === 0 && (
                    <p className="text-sm text-muted-foreground py-4">Nenhum template. Clique em &quot;Novo template&quot; para criar.</p>
                  )}
                  {!templatesLoading && templates.length > 0 && (
                    <ul className="space-y-2">
                      {templates.map((t) => (
                        <li
                          key={t.id}
                          className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/30"
                        >
                          <div>
                            <p className="font-medium">{t.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {t.max_participants} jogadores • Entrada R$ {Number(t.entry_fee).toFixed(2)} • Sua taxa {t.platform_fee_pct}% •
                              {formatLabels[t.format] ?? t.format} • {t.time_control} • {t.times_per_day}x/dia
                              {Array.isArray(t.time_slots) && t.time_slots.length > 0 && ` (${t.time_slots.join(", ")})`}
                            </p>
                          </div>
                          <div className="flex gap-1">
                            <Button variant="outline" size="icon" onClick={() => openEditTemplate(t)} title="Editar">
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => deleteTemplate(t.id)}
                              disabled={deletingId === t.id}
                              title="Excluir"
                            >
                              {deletingId === t.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4 text-destructive" />}
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>

      <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? "Editar template" : "Novo template"}</DialogTitle>
            <DialogDescription>Configure o torneio que será gerado automaticamente nos horários definidos.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Nome</Label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Ex: Arena Noturna" />
            </div>
            <div className="grid gap-2">
              <Label>Descrição (opcional)</Label>
              <Input value={formDescription} onChange={(e) => setFormDescription(e.target.value)} placeholder="Breve descrição" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Formato</Label>
                <Select value={formFormat} onValueChange={setFormFormat}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="swiss">Suíço</SelectItem>
                    <SelectItem value="knockout">Eliminação</SelectItem>
                    <SelectItem value="round_robin">Round Robin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Jogadores (máx.)</Label>
                <Input
                  type="number"
                  min={2}
                  max={256}
                  value={formMaxParticipants}
                  onChange={(e) => setFormMaxParticipants(parseInt(e.target.value, 10) || 32)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Entrada (R$)</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={formEntryFee}
                  onChange={(e) => setFormEntryFee(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="grid gap-2">
                <Label>Sua taxa (%)</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={formPlatformFeePct}
                  onChange={(e) => setFormPlatformFeePct(e.target.value)}
                  placeholder="10"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Valor do prêmio (R$)</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={formPrizePool}
                onChange={(e) => setFormPrizePool(e.target.value)}
                placeholder="0"
              />
            </div>
            <div className="grid gap-2">
              <Label>Controle de tempo</Label>
              <Input value={formTimeControl} onChange={(e) => setFormTimeControl(e.target.value)} placeholder="10+0" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Vezes por dia</Label>
                <Input
                  type="number"
                  min={1}
                  max={24}
                  value={formTimesPerDay}
                  onChange={(e) => setFormTimesPerDay(parseInt(e.target.value, 10) || 1)}
                />
              </div>
              <div className="grid gap-2">
                <Label>Horários (ex: 20:00, 22:00)</Label>
                <Input value={formTimeSlots} onChange={(e) => setFormTimeSlots(e.target.value)} placeholder="20:00" />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Duração (min, opcional)</Label>
              <Input
                type="number"
                min={0}
                value={formDurationMinutes}
                onChange={(e) => setFormDurationMinutes(e.target.value)}
                placeholder="Deixe vazio se não aplicável"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="formActive"
                checked={formActive}
                onChange={(e) => setFormActive(e.target.checked)}
                className="rounded border-input"
              />
              <Label htmlFor="formActive">Template ativo (incluído na geração)</Label>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setTemplateDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={saveTemplate} disabled={saveLoading || !formName.trim()}>
              {saveLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : editingTemplate ? "Salvar" : "Criar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Admin;
