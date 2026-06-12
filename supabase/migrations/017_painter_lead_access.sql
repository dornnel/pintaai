SET search_path TO pintae, public;

-- Pintor pode ver leads para os quais foi notificado
CREATE POLICY "leads_painter_notified" ON leads FOR SELECT USING (
  id IN (
    SELECT lpi.lead_id FROM lead_painter_interactions lpi
    JOIN painters p ON p.id = lpi.painter_id
    JOIN users u ON u.id = p.user_id
    WHERE u.auth_user_id = auth.uid()
  )
);

-- Pintor pode atualizar status da própria interação (ex: marcar 'replied')
CREATE POLICY "lpi_painter_update" ON lead_painter_interactions FOR UPDATE USING (
  painter_id IN (SELECT id FROM painters WHERE user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid()))
);
