-- Bucket para documentos RAG do agente conversacional
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'agent-docs',
  'agent-docs',
  true,
  52428800, -- 50MB
  ARRAY[
    'application/pdf',
    'text/plain',
    'text/markdown',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Policy: admins autenticados podem fazer upload
CREATE POLICY "Admins can upload agent docs"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'agent-docs');

-- Policy: leitura pública (docs são referências do agente, não dados sensíveis)
CREATE POLICY "Public read agent docs"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'agent-docs');

-- Policy: apenas autenticados podem deletar
CREATE POLICY "Admins can delete agent docs"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'agent-docs');
