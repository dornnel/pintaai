import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.test.local' })
dotenv.config({ path: '.env' })

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.test.local')
}

// App DB client (pintae schema)
const appClient = createClient(SUPABASE_URL, SERVICE_KEY, { db: { schema: 'pintae' } })
// Auth client (default schema for auth.admin.*)
const authClient = createClient(SUPABASE_URL, SERVICE_KEY)

export async function deleteUserByEmail(email: string): Promise<void> {
  // Find in Supabase Auth and delete
  const { data: { users } } = await authClient.auth.admin.listUsers({ perPage: 1000 })
  const authUser = users.find(u => u.email === email)
  if (authUser) {
    await authClient.auth.admin.deleteUser(authUser.id)
  }
  // Also delete from pintae.users (in case Auth cascade doesn't cover it)
  await appClient.from('users').delete().eq('email', email)
}

export async function confirmUserByEmail(email: string): Promise<void> {
  const { data: { users } } = await authClient.auth.admin.listUsers({ perPage: 1000 })
  const authUser = users.find(u => u.email === email)
  if (!authUser) throw new Error(`User ${email} not found in Supabase Auth`)
  await authClient.auth.admin.updateUser(authUser.id, { email_confirm: true })
}

export async function ensureTestCustomer(
  email: string, password: string, name: string
): Promise<{ userId: string }> {
  // Check if already exists in pintae.users
  const { data: existing } = await appClient.from('users').select('id').eq('email', email).maybeSingle()
  if (existing) {
    // Make sure email is confirmed in Auth
    try { await confirmUserByEmail(email) } catch { /* already confirmed */ }
    return { userId: existing.id }
  }

  // Create via Auth admin API (already confirmed)
  const { data: authData, error } = await authClient.auth.admin.createUser({
    email, password, email_confirm: true,
  })
  if (error || !authData.user) throw error ?? new Error('Failed to create auth user')

  // Create pintae.users record
  const { data: userRow, error: insertErr } = await appClient.from('users').insert({
    auth_user_id: authData.user.id,
    email, name,
    role: 'customer', roles: ['customer'],
    status: 'active',
    registration_source: 'test',
  }).select('id').single()

  if (insertErr) throw insertErr
  return { userId: userRow!.id }
}

export async function ensureTestPainter(
  email: string, password: string, name: string
): Promise<{ userId: string }> {
  const { userId } = await ensureTestCustomer(email, password, name)

  // Update role to painter
  await appClient.from('users').update({ role: 'painter', roles: ['painter'] }).eq('id', userId)

  // Check/create painter record
  const { data: existing } = await appClient.from('painters').select('id').eq('user_id', userId).maybeSingle()
  if (!existing) {
    const { data: neighborhoods } = await appClient
      .from('neighborhoods').select('id, name').in('name', ['Campeche', 'Rio Tavares'])
    const neighborhoodIds = (neighborhoods ?? []).map(n => n.id)

    await appClient.from('painters').insert({
      user_id: userId,
      bio: 'Pintor experiente em Floripa',
      years_experience: 5,
      specialties: ['Pintura interna', 'Fachada'],
      neighborhoods_ids: neighborhoodIds,
      availability_status: 'available',
      verification_status: 'unverified',
      kyc_status: 'not_started',
      service_radius_km: 10,
    })
  }

  return { userId }
}

export async function seedTestLead(customerEmail: string): Promise<{ leadId: string }> {
  const protocol = `PT-TEST-${Date.now()}`
  const { data: lead, error } = await appClient.from('leads').insert({
    name: 'Ana Teste E2E',
    email: customerEmail,
    phone: '48999990000',
    source: 'test',
    source_detail: 'e2e_test',
    service_interest: 'Pintura interna',
    neighborhood: 'Campeche',
    property_type: 'Apartamento',
    wall_condition: 'Bom estado',
    deadline: '2 semanas',
    material: 'incluso',
    num_rooms: 2,
    area_m2: 26,
    calc_price_min: 600,
    calc_price_max: 1200,
    calc_confidence: 'media',
    stage: 'new',
    stage_updated_at: new Date().toISOString(),
    protocol,
    is_partial: false,
    tags: ['e2e_test'],
  }).select('id').single()

  if (error) throw error
  return { leadId: lead!.id }
}

export async function distributeLeadToPainter(
  leadId: string, painterEmail: string
): Promise<{ interactionId: string }> {
  const { data: painterUser } = await appClient.from('users').select('id').eq('email', painterEmail).single()
  if (!painterUser) throw new Error(`Painter user not found: ${painterEmail}`)

  const { data: painter } = await appClient.from('painters').select('id').eq('user_id', painterUser.id).single()
  if (!painter) throw new Error(`Painter record not found for user: ${painterEmail}`)

  const { data: interaction, error } = await appClient.from('lead_painter_interactions').insert({
    lead_id: leadId,
    painter_id: painter.id,
    status: 'notified',
    notified_at: new Date().toISOString(),
  }).select('id').single()

  if (error) throw error

  // Update lead stage
  await appClient.from('leads').update({
    stage: 'proposal_sent',
    stage_updated_at: new Date().toISOString(),
    painter_ids_notified: [painter.id],
  }).eq('id', leadId)

  return { interactionId: interaction!.id }
}

export async function cleanupTestLeads(customerEmail: string): Promise<void> {
  const { data: leads } = await appClient.from('leads').select('id').eq('email', customerEmail).eq('source', 'test')
  if (!leads || leads.length === 0) return

  const leadIds = leads.map(l => l.id)
  await appClient.from('lead_painter_interactions').delete().in('lead_id', leadIds)
  await appClient.from('leads').delete().in('id', leadIds)
}
