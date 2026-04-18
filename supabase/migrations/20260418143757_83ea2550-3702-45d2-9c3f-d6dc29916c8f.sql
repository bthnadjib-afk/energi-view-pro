INSERT INTO storage.buckets (id, name, public)
VALUES ('document-logos', 'document-logos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read document-logos"
ON storage.objects FOR SELECT
USING (bucket_id = 'document-logos');

CREATE POLICY "Authenticated upload document-logos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'document-logos');

CREATE POLICY "Authenticated update document-logos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'document-logos');

CREATE POLICY "Admins delete document-logos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'document-logos' AND has_role(auth.uid(), 'admin'::app_role));