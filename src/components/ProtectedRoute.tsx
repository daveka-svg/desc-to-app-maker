import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import type { Session } from '@supabase/supabase-js';

type AuthState = 'loading' | 'allowed' | 'denied' | 'no-session';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>('loading');

  useEffect(() => {
    const checkAccess = async (session: Session | null) => {
      if (!session) {
        setAuthState('no-session');
        return;
      }
      const { data } = await supabase.rpc('is_email_allowed', { _email: session.user.email || '' });
      if (!data) {
        await supabase.auth.signOut();
        setAuthState('no-session');
        return;
      }
      setAuthState('allowed');
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      checkAccess(session);
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      checkAccess(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (authState === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream">
        <div className="animate-spin w-8 h-8 border-4 border-forest border-t-transparent rounded-full" />
      </div>
    );
  }

  if (authState !== 'allowed') return <Navigate to="/auth" replace />;

  return <>{children}</>;
}
