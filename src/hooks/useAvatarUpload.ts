import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useToast } from "./use-toast";

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "gif", "webp", "bmp", "heic", "heif", "ico"]);

function isImageFile(file: File): boolean {
  if (file.type.startsWith("image/")) return true;
  const ext = file.name.split(".").pop()?.toLowerCase();
  return ext ? IMAGE_EXTENSIONS.has(ext) : false;
}

export function useAvatarUpload() {
  const { user, updateProfile } = useAuth();
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!isImageFile(file)) {
      toast({
        variant: "destructive",
        title: "Arquivo inválido",
        description: "Selecione uma imagem (JPEG, PNG, GIF, WebP, etc.).",
      });
      return;
    }

    if (file.size > MAX_SIZE_BYTES) {
      toast({
        variant: "destructive",
        title: "Arquivo grande",
        description: "A imagem deve ter no máximo 10MB.",
      });
      return;
    }

    setUploading(true);
    e.target.value = "";

    try {
      const fileExt = (file.name.split(".").pop() || "jpg").toLowerCase().replace("jpeg", "jpg");
      const filePath = `${user.id}/avatar.${fileExt}`;
      const contentType = file.type && file.type.startsWith("image/") ? file.type : "image/jpeg";

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true, contentType });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(filePath);

      const { error: updateError } = await updateProfile({ avatar_url: publicUrl });
      if (updateError) throw updateError;

      toast({
        title: "Foto atualizada!",
        description: "Sua foto de perfil foi alterada.",
      });
    } catch {
      toast({
        variant: "destructive",
        title: "Erro ao enviar foto",
        description: "Tente novamente.",
      });
    } finally {
      setUploading(false);
    }
  };

  return { handleAvatarUpload, uploading };
}
