-- Promote andre@midias.club: painter → admin (keeps painter for role-switch)
UPDATE pintae.users
  SET role = 'admin', roles = ARRAY['admin','painter']::text[]
  WHERE email = 'andre@midias.club';

INSERT INTO pintae.admin_permissions
  (user_id, can_manage_users, can_manage_painters, can_approve_kyc,
   can_view_payments, can_manage_products, can_view_all_crm,
   can_ban_users, can_manage_admins, updated_at)
SELECT id, true, true, true, true, true, true, true, false, NOW()
  FROM pintae.users WHERE email = 'andre@midias.club'
ON CONFLICT (user_id) DO UPDATE SET
  can_manage_users=true, can_manage_painters=true, can_approve_kyc=true,
  can_view_payments=true, can_manage_products=true, can_view_all_crm=true,
  can_ban_users=true, can_manage_admins=false, updated_at=NOW();

-- Promote sandroselecta@gmail.com: painter → admin (keeps painter for role-switch)
UPDATE pintae.users
  SET role = 'admin', roles = ARRAY['admin','painter']::text[]
  WHERE email = 'sandroselecta@gmail.com';

INSERT INTO pintae.admin_permissions
  (user_id, can_manage_users, can_manage_painters, can_approve_kyc,
   can_view_payments, can_manage_products, can_view_all_crm,
   can_ban_users, can_manage_admins, updated_at)
SELECT id, true, true, true, true, true, true, true, false, NOW()
  FROM pintae.users WHERE email = 'sandroselecta@gmail.com'
ON CONFLICT (user_id) DO UPDATE SET
  can_manage_users=true, can_manage_painters=true, can_approve_kyc=true,
  can_view_payments=true, can_manage_products=true, can_view_all_crm=true,
  can_ban_users=true, can_manage_admins=false, updated_at=NOW();

-- Promote alessandrokoke@gmail.com: customer → admin (keeps customer for role-switch)
UPDATE pintae.users
  SET role = 'admin', roles = ARRAY['admin','customer']::text[]
  WHERE email = 'alessandrokoke@gmail.com';

INSERT INTO pintae.admin_permissions
  (user_id, can_manage_users, can_manage_painters, can_approve_kyc,
   can_view_payments, can_manage_products, can_view_all_crm,
   can_ban_users, can_manage_admins, updated_at)
SELECT id, true, true, true, true, true, true, true, false, NOW()
  FROM pintae.users WHERE email = 'alessandrokoke@gmail.com'
ON CONFLICT (user_id) DO UPDATE SET
  can_manage_users=true, can_manage_painters=true, can_approve_kyc=true,
  can_view_payments=true, can_manage_products=true, can_view_all_crm=true,
  can_ban_users=true, can_manage_admins=false, updated_at=NOW();
