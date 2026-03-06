import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable/index';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

export default function Auth() {
  const [googleLoading, setGoogleLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session) {
        const allowed = await checkWhitelist(session.user.email || '');
        if (!allowed) {
          await supabase.auth.signOut();
          toast({
            title: 'Access denied',
            description: 'Your email is not on the approved list. Please contact your admin for an invitation.',
            variant: 'destructive',
          });
          return;
        }
        navigate('/', { replace: true });
      }
    });
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        const allowed = await checkWhitelist(session.user.email || '');
        if (!allowed) {
          await supabase.auth.signOut();
          return;
        }
        navigate('/', { replace: true });
      }
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  const checkWhitelist = async (email: string): Promise<boolean> => {
    const { data, error } = await supabase.rpc('is_email_allowed', { _email: email });
    if (error) {
      console.error('Whitelist check failed:', error);
      return false;
    }
    return !!data;
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      const { error } = await lovable.auth.signInWithOAuth('google', {
        redirect_uri: window.location.origin,
        extraParams: {
          hd: 'everytailvets.co.uk',
        },
      });
      if (error) throw error;
    } catch (err: any) {
      toast({ title: 'Google sign-in failed', description: err.message || 'Please try again.', variant: 'destructive' });
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-cream">
      <div className="w-full max-w-sm mx-auto p-8 bg-card rounded-xl shadow-md border border-border">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 rounded-lg bg-forest flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">E</span>
          </div>
          <span className="font-semibold text-lg text-text-primary">ETV Scribe</span>
        </div>

        <h2 className="text-xl font-semibold mb-1 text-text-primary">Welcome</h2>
        <p className="text-sm mb-6 text-text-muted">
          Sign in with your Every Tail Vets Google account
        </p>

        <Button
          type="button"
          className="w-full bg-forest hover:bg-forest-dark"
          onClick={handleGoogleSignIn}
          disabled={googleLoading}
        >
          {googleLoading ? 'Redirecting to Google...' : 'Sign in with Google'}
        </Button>

        <p className="text-center text-xs mt-4 text-text-muted">
          Access is restricted to approved team members only.
        </p>
      </div>
    </div>
  );
}
