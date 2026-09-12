import { createClient } from '@supabase/supabase-js'

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
export const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null
export const isSupabaseConfigured = Boolean(supabase)

export type BackendBlock = {
  id: string
  name: string
  daily_quota_liters: number
  scheduled_liters: number
  delivery_window_start: string | null
  delivery_window_end: string | null
  active: boolean
}

export type BackendDelivery = {
  id: string
  tanker_id: string
  driver_name: string
  block_id: string
  claimed_volume_liters: number
  meter_reading: number
  photo_url: string
  status: 'PENDING' | 'VERIFIED' | 'DISPUTED'
  possible_duplicate: boolean
  off_hours: boolean
  volume_mismatch: boolean
  risk_score: number
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH'
  submitted_at: string
  verified_at: string | null
  disputed_at: string | null
  dispute_reason: string | null
  manager_comment: string | null
  created_at: string
  updated_at: string
  tankers?: { tanker_number: string; driver_name: string } | null
  blocks?: { name: string; daily_quota_liters: number } | null
}

export type BackendEvent = {
  id: string
  delivery_id: string
  action: string
  comment: string | null
  metadata: Record<string, unknown>
  created_at: string
  actor?: { name: string } | null
}

export type PublicSupplyRow = {
  id: string
  name: string
  daily_quota_liters: number
  verified_volume_liters: number
  under_review_liters: number
  last_verified_at: string | null
}

export async function loadPublicSupply() {
  if (!supabase) throw new Error('Supabase is not configured')
  const { data, error } = await supabase.from('public_supply_today').select('*').order('name')
  if (error) throw error
  return data as PublicSupplyRow[]
}

export async function loadBackendData() {
  if (!supabase) throw new Error('Supabase is not configured')
  const [blocksResult, deliveriesResult, eventsResult] = await Promise.all([
    supabase.from('blocks').select('*').eq('active', true).order('name'),
    supabase.from('deliveries').select('*, tankers(tanker_number, driver_name), blocks(name, daily_quota_liters)').order('submitted_at', { ascending: false }),
    supabase.from('audit_events').select('*, actor:users(name)').order('created_at', { ascending: false }),
  ])
  if (blocksResult.error) throw blocksResult.error
  if (deliveriesResult.error) throw deliveriesResult.error
  if (eventsResult.error) throw eventsResult.error
  return { blocks: blocksResult.data as BackendBlock[], deliveries: deliveriesResult.data as BackendDelivery[], events: eventsResult.data as BackendEvent[] }
}

export async function compressMeterPhoto(file: File): Promise<File> {
  if (file.size > 5_000_000) throw new Error('Photo is too large. Choose an image under 5 MB.')
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file.')
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, 1000 / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.82))
  if (!blob) throw new Error('Unable to compress photo. Please try again.')
  return new File([blob], 'meter-photo.jpg', { type: 'image/jpeg' })
}

export async function submitDelivery(input: { tankerNumber: string; driverName: string; blockId: string; claimedVolume: number; meterReading: number; file: File; note?: string }) {
  if (!supabase) throw new Error('Supabase is not configured')
  const deliveryId = crypto.randomUUID()
  const compressed = await compressMeterPhoto(input.file)
  const path = `${deliveryId}/meter-photo.jpg`
  const upload = await supabase.storage.from('delivery-evidence').upload(path, compressed, { contentType: 'image/jpeg', upsert: false })
  if (upload.error) throw upload.error
  const { data, error } = await supabase.rpc('submit_delivery', {
    p_delivery_id: deliveryId,
    p_tanker_number: input.tankerNumber,
    p_driver_name: input.driverName,
    p_block_id: input.blockId,
    p_claimed_volume_liters: input.claimedVolume,
    p_meter_reading: input.meterReading,
    p_photo_path: path,
    p_driver_note: input.note ?? null,
  })
  if (error) {
    await supabase.storage.from('delivery-evidence').remove([path])
    throw error
  }
  return data as BackendDelivery
}

export async function verifyDelivery(deliveryId: string, comment = 'Verified after evidence review.') {
  if (!supabase) throw new Error('Supabase is not configured')
  const { data, error } = await supabase.rpc('verify_delivery', { p_delivery_id: deliveryId, p_comment: comment })
  if (error) throw error
  return data as BackendDelivery
}

export async function disputeDelivery(deliveryId: string, reason: string, comment: string) {
  if (!supabase) throw new Error('Supabase is not configured')
  const { data, error } = await supabase.rpc('dispute_delivery', { p_delivery_id: deliveryId, p_reason: reason, p_comment: comment })
  if (error) throw error
  return data as BackendDelivery
}

export async function getEvidenceUrl(path: string) {
  if (!supabase) return path
  const { data, error } = await supabase.storage.from('delivery-evidence').createSignedUrl(path, 300)
  if (error) throw error
  return data.signedUrl
}
