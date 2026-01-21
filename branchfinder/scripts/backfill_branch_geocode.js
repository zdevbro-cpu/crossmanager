import dotenv from 'dotenv';
import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const clientId = (process.env.VITE_NAVER_MAP_CLIENT_ID || '').trim();
const clientSecret = (process.env.VITE_NAVER_MAP_CLIENT_SECRET || '').trim();

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase env vars (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).');
  process.exit(1);
}

if (!clientId || !clientSecret) {
  console.error('Missing Naver Map env vars (VITE_NAVER_MAP_CLIENT_ID / VITE_NAVER_MAP_CLIENT_SECRET).');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const geocodeAddress = async (address) => {
  const url = `https://maps.apigw.ntruss.com/map-geocode/v2/geocode?query=${encodeURIComponent(address)}`;
  const response = await fetch(url, {
    headers: {
      'X-NCP-APIGW-API-KEY-ID': clientId,
      'X-NCP-APIGW-API-KEY': clientSecret,
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Geocode failed (${response.status}): ${text.slice(0, 200)}`);
  }

  const data = await response.json();
  if (!data.addresses || data.addresses.length === 0) {
    return null;
  }

  const { x, y } = data.addresses[0];
  const lng = Number.parseFloat(x);
  const lat = Number.parseFloat(y);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }
  return { lat, lng };
};

const isMissing = (value) => {
  if (value === null || value === undefined) return true;
  const num = Number(value);
  return !Number.isFinite(num) || num === 0;
};

const run = async () => {
  const { data, error } = await supabase.from('branches').select('*');
  if (error) {
    console.error('Failed to fetch branches:', error);
    process.exit(1);
  }

  let updated = 0;
  for (const branch of data) {
    if (!isMissing(branch.lat) && !isMissing(branch.lng)) {
      continue;
    }
    if (!branch.address) {
      console.warn(`Skip ${branch.id}: missing address`);
      continue;
    }

    console.log(`Geocoding ${branch.id} (${branch.name}) -> ${branch.address}`);
    const coords = await geocodeAddress(branch.address);
    if (!coords) {
      console.warn(`No geocode result: ${branch.id} (${branch.address})`);
      continue;
    }

    const { error: updateError } = await supabase
      .from('branches')
      .update({ lat: coords.lat, lng: coords.lng })
      .eq('id', branch.id);

    if (updateError) {
      console.error(`Update failed for ${branch.id}:`, updateError);
      continue;
    }
    updated += 1;
    console.log(`Updated ${branch.id}: ${coords.lat}, ${coords.lng}`);
  }

  console.log(`Done. Updated ${updated} branches.`);
};

run().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
