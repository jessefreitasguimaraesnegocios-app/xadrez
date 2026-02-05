import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Camera, Save, Trophy, Target, TrendingUp, TrendingDown, Clock, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

const Profile = () => {
  const { user, profile, loading, updateProfile } = useAuth();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  const [displayName, setDisplayName] = useState(profile?.display_name || '');
  const [bio, setBio] = useState(profile?.bio || '');

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

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Por favor, selecione uma imagem válida.',
      });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'A imagem deve ter no máximo 2MB.',
      });
      return;
    }

    setUploading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `${user.id}/avatar.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      await updateProfile({ avatar_url: publicUrl });

      toast({
        title: 'Avatar atualizado!',
        description: 'Seu avatar foi atualizado com sucesso.',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao enviar avatar',
        description: 'Tente novamente mais tarde.',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);

    const { error } = await updateProfile({
      display_name: displayName,
      bio,
    });

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar',
        description: error.message,
      });
    } else {
      toast({
        title: 'Perfil atualizado!',
        description: 'Suas alterações foram salvas.',
      });
      setIsEditing(false);
    }

    setIsSaving(false);
  };

  const totalGames = (profile?.wins || 0) + (profile?.losses || 0) + (profile?.draws || 0);
  const winRate = totalGames > 0 ? ((profile?.wins || 0) / totalGames * 100).toFixed(1) : '0';

  const stats = [
    { label: 'Vitórias', value: profile?.wins || 0, icon: TrendingUp, color: 'text-bet-win' },
    { label: 'Derrotas', value: profile?.losses || 0, icon: TrendingDown, color: 'text-bet-lose' },
    { label: 'Empates', value: profile?.draws || 0, icon: Target, color: 'text-muted-foreground' },
    { label: 'Taxa de Vitória', value: `${winRate}%`, icon: Trophy, color: 'text-accent' },
  ];

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Back Button */}
        <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </Link>

        {/* Profile Header */}
        <Card className="border-border">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
              {/* Avatar */}
              <div className="relative group">
                <Avatar className="w-32 h-32 border-4 border-primary">
                  <AvatarImage src={profile?.avatar_url || undefined} />
                  <AvatarFallback className="text-4xl font-bold">
                    {profile?.username?.charAt(0).toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                <label className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarUpload}
                    disabled={uploading}
                  />
                  {uploading ? (
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white" />
                  ) : (
                    <Camera className="w-8 h-8 text-white" />
                  )}
                </label>
              </div>

              {/* User Info */}
              <div className="flex-1 text-center md:text-left">
                <div className="flex items-center justify-center md:justify-start gap-3">
                  <h1 className="text-3xl font-display font-bold">
                    {profile?.display_name || profile?.username}
                  </h1>
                  <div className="px-3 py-1 bg-primary/20 rounded-full">
                    <span className="text-primary font-bold">{profile?.elo_rating || 1200} ELO</span>
                  </div>
                </div>
                <p className="text-muted-foreground mt-1">@{profile?.username}</p>
                {profile?.bio && (
                  <p className="text-foreground/80 mt-3 max-w-lg">{profile.bio}</p>
                )}
              </div>

              {/* Edit Button */}
              <Button
                variant={isEditing ? 'secondary' : 'outline'}
                onClick={() => setIsEditing(!isEditing)}
              >
                {isEditing ? 'Cancelar' : 'Editar Perfil'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Edit Form */}
        {isEditing && (
          <Card className="border-border">
            <CardHeader>
              <CardTitle>Editar Perfil</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="displayName">Nome de exibição</Label>
                <Input
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Seu nome de exibição"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bio">Biografia</Label>
                <Textarea
                  id="bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Conte um pouco sobre você..."
                  rows={3}
                />
              </div>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground mr-2" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Salvar Alterações
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Statistics */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-accent" />
              Estatísticas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {stats.map((stat) => (
                <div key={stat.label} className="text-center p-4 bg-secondary/50 rounded-lg">
                  <stat.icon className={`w-6 h-6 mx-auto mb-2 ${stat.color}`} />
                  <p className="text-2xl font-display font-bold">{stat.value}</p>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                </div>
              ))}
            </div>
            
            <Separator className="my-6" />
            
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-secondary/50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-5 h-5 text-primary" />
                  <span className="text-sm text-muted-foreground">Total de Partidas</span>
                </div>
                <p className="text-2xl font-display font-bold">{totalGames}</p>
              </div>
              <div className="p-4 bg-secondary/50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Trophy className="w-5 h-5 text-accent" />
                  <span className="text-sm text-muted-foreground">Ganhos Totais</span>
                </div>
                <p className="text-2xl font-display font-bold text-accent">
                R$ {(profile?.total_winnings || 0).toFixed(2)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Profile;