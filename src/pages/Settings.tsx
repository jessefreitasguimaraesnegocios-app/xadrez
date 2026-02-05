import { useState, useEffect } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Volume2, VolumeX, Bell, BellOff, Moon, Sun, Monitor, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const Settings = () => {
  const { user, loading } = useAuth();
  const { toast } = useToast();
  
  // Settings state - persisted to localStorage
  const [soundEnabled, setSoundEnabled] = useState(() => {
    const saved = localStorage.getItem('settings_sound');
    return saved !== null ? JSON.parse(saved) : true;
  });
  
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    const saved = localStorage.getItem('settings_notifications');
    return saved !== null ? JSON.parse(saved) : true;
  });
  
  const [moveSound, setMoveSound] = useState(() => {
    const saved = localStorage.getItem('settings_move_sound');
    return saved !== null ? JSON.parse(saved) : true;
  });
  
  const [captureSound, setCaptureSound] = useState(() => {
    const saved = localStorage.getItem('settings_capture_sound');
    return saved !== null ? JSON.parse(saved) : true;
  });
  
  const [timerWarningSound, setTimerWarningSound] = useState(() => {
    const saved = localStorage.getItem('settings_timer_warning');
    return saved !== null ? JSON.parse(saved) : true;
  });
  
  const [gameStartNotification, setGameStartNotification] = useState(() => {
    const saved = localStorage.getItem('settings_game_start_notification');
    return saved !== null ? JSON.parse(saved) : true;
  });
  
  const [chatNotification, setChatNotification] = useState(() => {
    const saved = localStorage.getItem('settings_chat_notification');
    return saved !== null ? JSON.parse(saved) : true;
  });
  
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('settings_theme') || 'dark';
  });
  
  const [boardTheme, setBoardTheme] = useState(() => {
    return localStorage.getItem('settings_board_theme') || 'classic';
  });
  
  const [pieceStyle, setPieceStyle] = useState(() => {
    return localStorage.getItem('settings_piece_style') || 'classic';
  });

  // Save settings when they change
  useEffect(() => {
    localStorage.setItem('settings_sound', JSON.stringify(soundEnabled));
    localStorage.setItem('settings_notifications', JSON.stringify(notificationsEnabled));
    localStorage.setItem('settings_move_sound', JSON.stringify(moveSound));
    localStorage.setItem('settings_capture_sound', JSON.stringify(captureSound));
    localStorage.setItem('settings_timer_warning', JSON.stringify(timerWarningSound));
    localStorage.setItem('settings_game_start_notification', JSON.stringify(gameStartNotification));
    localStorage.setItem('settings_chat_notification', JSON.stringify(chatNotification));
    localStorage.setItem('settings_theme', theme);
    localStorage.setItem('settings_board_theme', boardTheme);
    localStorage.setItem('settings_piece_style', pieceStyle);
  }, [soundEnabled, notificationsEnabled, moveSound, captureSound, timerWarningSound, gameStartNotification, chatNotification, theme, boardTheme, pieceStyle]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  const handleSave = () => {
    toast({
      title: 'Configurações salvas!',
      description: 'Suas preferências foram atualizadas.',
    });
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Back Button */}
        <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </Link>

        <div>
          <h1 className="text-3xl font-display font-bold">Configurações</h1>
          <p className="text-muted-foreground mt-1">Personalize sua experiência de jogo</p>
        </div>

        {/* Sound Settings */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
              Som
            </CardTitle>
            <CardDescription>Configure os efeitos sonoros do jogo</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="sound-enabled" className="flex-1">
                <span className="font-medium">Ativar sons</span>
                <p className="text-sm text-muted-foreground">Liga/desliga todos os sons</p>
              </Label>
              <Switch
                id="sound-enabled"
                checked={soundEnabled}
                onCheckedChange={setSoundEnabled}
              />
            </div>
            
            <Separator />
            
            <div className="space-y-4 pl-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="move-sound">Som de movimento</Label>
                <Switch
                  id="move-sound"
                  checked={moveSound}
                  onCheckedChange={setMoveSound}
                  disabled={!soundEnabled}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <Label htmlFor="capture-sound">Som de captura</Label>
                <Switch
                  id="capture-sound"
                  checked={captureSound}
                  onCheckedChange={setCaptureSound}
                  disabled={!soundEnabled}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <Label htmlFor="timer-warning">Alerta de tempo baixo</Label>
                <Switch
                  id="timer-warning"
                  checked={timerWarningSound}
                  onCheckedChange={setTimerWarningSound}
                  disabled={!soundEnabled}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notification Settings */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {notificationsEnabled ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
              Notificações
            </CardTitle>
            <CardDescription>Configure quando deseja ser notificado</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="notifications-enabled" className="flex-1">
                <span className="font-medium">Ativar notificações</span>
                <p className="text-sm text-muted-foreground">Receba alertas sobre suas partidas</p>
              </Label>
              <Switch
                id="notifications-enabled"
                checked={notificationsEnabled}
                onCheckedChange={setNotificationsEnabled}
              />
            </div>
            
            <Separator />
            
            <div className="space-y-4 pl-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="game-start">Início de partida</Label>
                <Switch
                  id="game-start"
                  checked={gameStartNotification}
                  onCheckedChange={setGameStartNotification}
                  disabled={!notificationsEnabled}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <Label htmlFor="chat-notification">Mensagens do chat</Label>
                <Switch
                  id="chat-notification"
                  checked={chatNotification}
                  onCheckedChange={setChatNotification}
                  disabled={!notificationsEnabled}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Appearance Settings */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Moon className="w-5 h-5" />
              Aparência
            </CardTitle>
            <CardDescription>Personalize a aparência do jogo</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="theme" className="flex-1">
                <span className="font-medium">Tema</span>
                <p className="text-sm text-muted-foreground">Escolha o tema da interface</p>
              </Label>
              <Select value={theme} onValueChange={setTheme}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dark">
                    <div className="flex items-center gap-2">
                      <Moon className="w-4 h-4" />
                      Escuro
                    </div>
                  </SelectItem>
                  <SelectItem value="light">
                    <div className="flex items-center gap-2">
                      <Sun className="w-4 h-4" />
                      Claro
                    </div>
                  </SelectItem>
                  <SelectItem value="system">
                    <div className="flex items-center gap-2">
                      <Monitor className="w-4 h-4" />
                      Sistema
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <Separator />
            
            <div className="flex items-center justify-between">
              <Label htmlFor="board-theme" className="flex-1">
                <span className="font-medium">Tema do tabuleiro</span>
                <p className="text-sm text-muted-foreground">Cores do tabuleiro de xadrez</p>
              </Label>
              <Select value={boardTheme} onValueChange={setBoardTheme}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="classic">Clássico</SelectItem>
                  <SelectItem value="green">Verde</SelectItem>
                  <SelectItem value="blue">Azul</SelectItem>
                  <SelectItem value="brown">Madeira</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center justify-between">
              <Label htmlFor="piece-style" className="flex-1">
                <span className="font-medium">Estilo das peças</span>
                <p className="text-sm text-muted-foreground">Aparência das peças de xadrez</p>
              </Label>
              <Select value={pieceStyle} onValueChange={setPieceStyle}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="classic">Clássico</SelectItem>
                  <SelectItem value="neo">Neo</SelectItem>
                  <SelectItem value="alpha">Alpha</SelectItem>
                  <SelectItem value="chess24">Chess24</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <Button onClick={handleSave} className="w-full gap-2">
          <Save className="w-4 h-4" />
          Salvar Configurações
        </Button>
      </div>
    </div>
  );
};

export default Settings;