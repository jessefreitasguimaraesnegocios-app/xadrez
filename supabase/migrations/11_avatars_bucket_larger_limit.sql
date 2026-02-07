-- Aceitar fotos maiores e mais formatos (evitar rejeição de fotos do celular/câmera)
UPDATE storage.buckets
SET
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY[
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/bmp',
    'image/x-icon',
    'image/heic'
  ]
WHERE id = 'avatars';
