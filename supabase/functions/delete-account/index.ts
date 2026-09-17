// Verwijdert het account van de ingelogde gebruiker, inclusief alles wat eraan hangt.
// Eerst de bestanden in de opslag (die gaan niet mee met een cascade), daarna de gebruiker
// zelf; de databaserijen verdwijnen dan via de foreign keys.
//
// Draait als Supabase Edge Function met de service-role sleutel; die staat alleen op de server.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('SITE_URL') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') {
    return json({ error: 'Alleen POST' }, 405);
  }

  const authorization = request.headers.get('Authorization');
  if (authorization === null) return json({ error: 'Niet ingelogd' }, 401);

  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (url === undefined || serviceKey === undefined) return json({ error: 'Server niet compleet ingericht' }, 500);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  const { data: userData, error: userError } = await admin.auth.getUser(authorization.replace('Bearer ', ''));
  if (userError !== null || userData.user === null) return json({ error: 'Niet ingelogd' }, 401);

  const userId = userData.user.id;

  // 1. Bestanden in de eigen map weggooien.
  const { data: files } = await admin.storage.from('offertes').list(userId, { limit: 1000 });
  if (files !== null && files.length > 0) {
    const paths = files.map((file) => `${userId}/${file.name}`);
    const { error: removeError } = await admin.storage.from('offertes').remove(paths);
    if (removeError !== null) return json({ error: 'De bestanden konden niet worden verwijderd' }, 500);
  }

  // 2. De gebruiker zelf; plannen, invoer, versies en realisatie gaan mee via de cascade.
  const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
  if (deleteError !== null) return json({ error: 'Het account kon niet worden verwijderd' }, 500);

  return json({ deleted: true }, 200);
});

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
