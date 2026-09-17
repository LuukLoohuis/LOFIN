import { create } from 'zustand';
import { supabase } from '../../lib/supabase';
import { usePlanStore } from '../../data/planStore';

export interface SessionUser {
  id: string;
  email: string;
}

interface SessionState {
  user: SessionUser | null;
  ready: boolean;
  /** Er is pas een account mogelijk als Supabase is ingesteld. */
  available: boolean;
  lastMessage: string | null;
  start: () => void;
  sendMagicLink: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
}

export const useSession = create<SessionState>((set) => ({
  user: null,
  ready: supabase === null,
  available: supabase !== null,
  lastMessage: null,

  start: () => {
    const client = supabase;
    if (client === null) return;

    const apply = (user: SessionUser | null) => {
      set({ user, ready: true });
      void usePlanStore.getState().useAccount(user?.id ?? null);
    };

    void client.auth.getSession().then(({ data }) => {
      apply(toUser(data.session?.user ?? null));
    });
    client.auth.onAuthStateChange((_event: string, session: { user: { id: string; email?: string } } | null) => {
      apply(toUser(session?.user ?? null));
    });
  },

  sendMagicLink: async (email) => {
    if (supabase === null) throw new Error('Inloggen is nog niet ingesteld');
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/` },
    });
    if (error !== null) throw new Error(error.message);
    set({ lastMessage: `We hebben een inloglink gestuurd naar ${email}.` });
  },

  signOut: async () => {
    if (supabase === null) return;
    await supabase.auth.signOut();
    set({ user: null, lastMessage: 'Je bent uitgelogd.' });
    void usePlanStore.getState().useAccount(null);
  },

  deleteAccount: async () => {
    if (supabase === null) throw new Error('Er is geen account om te verwijderen');
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (token === undefined) throw new Error('Je bent niet ingelogd');

    const response = await supabase.functions.invoke('delete-account', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (response.error !== null) {
      throw new Error(response.error instanceof Error ? response.error.message : 'Verwijderen lukte niet');
    }

    await supabase.auth.signOut();
    set({ user: null, lastMessage: 'Je account en al je gegevens zijn verwijderd.' });
    void usePlanStore.getState().useAccount(null);
  },
}));

function toUser(user: { id: string; email?: string } | null): SessionUser | null {
  return user === null ? null : { id: user.id, email: user.email ?? '' };
}
