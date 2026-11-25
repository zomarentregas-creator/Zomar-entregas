-- Limites e papel correcto nos documentos privados
UPDATE storage.buckets
   SET file_size_limit    = 5242880,  -- 5 MB
       allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
 WHERE id = 'documents';

ALTER POLICY "Users can upload own documents" ON storage.objects TO authenticated;
