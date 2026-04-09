import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface Notificatie {
  id: string;
  voor_gebruiker_naam: string;
  van_gebruiker_naam: string | null;
  type: string;
  bericht: string;
  taak_id: string | null;
  project_naam: string | null;
  gelezen: boolean;
  created_at: string;
}

export function useNotificaties(gebruikerNaam: string | undefined) {
  const [notificaties, setNotificaties] = useState<Notificatie[]>([]);

  useEffect(() => {
    if (!gebruikerNaam) return;

    async function load() {
      const { data } = await (supabase as any)
        .from('notificaties')
        .select('*')
        .eq('voor_gebruiker_naam', gebruikerNaam)
        .order('created_at', { ascending: false })
        .limit(40);
      if (data) setNotificaties(data);
    }
    load();

    // Realtime: nieuwe notificaties direct tonen
    const channel = (supabase as any)
      .channel(`notificaties-${gebruikerNaam}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notificaties',
        filter: `voor_gebruiker_naam=eq.${gebruikerNaam}`,
      }, (payload: any) => {
        setNotificaties(prev => [payload.new as Notificatie, ...prev]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [gebruikerNaam]);

  const ongelezen = notificaties.filter(n => !n.gelezen).length;

  const markeerGelezen = async (id: string) => {
    await supabase.functions.invoke('data-access', {
      body: { table: 'notificaties', action: 'update', id, data: { gelezen: true } },
    });
    setNotificaties(prev => prev.map(n => n.id === id ? { ...n, gelezen: true } : n));
  };

  const markeerAllesGelezen = async () => {
    if (!gebruikerNaam) return;
    await supabase.functions.invoke('data-access', {
      body: {
        table: 'notificaties',
        action: 'update',
        filters: [
          { column: 'voor_gebruiker_naam', operator: 'eq', value: gebruikerNaam },
          { column: 'gelezen', operator: 'eq', value: false },
        ],
        data: { gelezen: true },
      },
    });
    setNotificaties(prev => prev.map(n => ({ ...n, gelezen: true })));
  };

  return { notificaties, ongelezen, markeerGelezen, markeerAllesGelezen };
}

/** Helper: maak een notificatie aan (fire-and-forget) */
export async function maakNotificatie(params: {
  voor_gebruiker_naam: string;
  van_gebruiker_naam: string;
  type: string;
  bericht: string;
  taak_id?: string;
  project_naam?: string;
}) {
  try {
    await (supabase as any).from('notificaties').insert({
      voor_gebruiker_naam: params.voor_gebruiker_naam,
      van_gebruiker_naam: params.van_gebruiker_naam,
      type: params.type,
      bericht: params.bericht,
      taak_id: params.taak_id ?? null,
      project_naam: params.project_naam ?? null,
    });
  } catch (e) {
    console.warn('Notificatie aanmaken mislukt:', e);
  }
}
