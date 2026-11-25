-- Admin pode ler documentos privados (verificação de entregadores/empresas)
CREATE POLICY "Admins can read all documents" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'documents' AND public.is_admin());
