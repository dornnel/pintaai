-- 047: Remove seed/test leads from CRM
-- Deletes: seeded fake data (sequential phones) + developer test entries (own emails)
-- Real leads (Jainara, Marina Furtado, Pablo, Sandro, Moreti, etc.) are preserved.
-- Run only after explicit approval.

SET search_path TO pintae, public;

-- 1. Fake seed data — sequential phone numbers inserted during development
DELETE FROM leads
 WHERE phone IN (
   '48991234001','48991234002','48991234003','48991234004',
   '48991234005','48991234006','48991234007','48991234008'
 );

-- 2. Developer's own test conversations (owner emails)
DELETE FROM leads
 WHERE email IN (
   'dornelex@gmail.com',
   'andre@agenscia.com',
   'andre@midias.club',
   'Dorneles@ciasc.sc.gov.br'
 );

-- 3. Null-email test entry with developer's own phone (489918122555)
--    name="André", created 2026-07-22, no email collected
DELETE FROM leads
 WHERE phone = '489918122555'
   AND email IS NULL
   AND created_at::date = '2026-07-22';
