import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    supabase.auth.onAuthStateChange((event, session) => {
      if (session) navigate('/', { replace: true });
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate('/', { replace: true });
    });
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: displayName || email.split('@')[0] },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        toast({ title: 'Check your email', description: 'We sent you a confirmation link.' });
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-cream">
      <div className="w-full max-w-sm mx-auto p-8 bg-card rounded-xl shadow-md border border-border">
        <div className="flex items-center gap-2 mb-6">
          <div className="w-8 h-8 rounded-lg bg-forest flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">E</span>
          </div>
          <span className="font-semibold text-lg" style={{ color: 'hsl(var(--text))' }}>ETV Scribe</span>
        </div>

        <h2 className="text-xl font-semibold mb-1" style={{ color: 'hsl(var(--text))' }}>
          {isLogin ? 'Welcome back' : 'Create account'}
        </h2>
        <p className="text-sm mb-6" style={{ color: 'hsl(var(--text-muted))' }}>
          {isLogin ? 'Sign in to continue' : 'Sign up to get started'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div>
              <Label htmlFor="name">Display Name</Label>
              <Input id="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Dr. Smith" />
            </div>
          )}
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@clinic.com" />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </div>
          <Button type="submit" className="w-full bg-forest hover:bg-forest-dark" disabled={loading}>
            {loading ? 'Please wait...' : isLogin ? 'Sign In' : 'Sign Up'}
          </Button>
        </form>

        <p className="text-center text-sm mt-4" style={{ color: 'hsl(var(--text-muted))' }}>
          {isLogin ? "Don't have an account?" : 'Already have an account?'}{' '}
          <button onClick={() => setIsLogin(!isLogin)} className="text-forest font-medium hover:underline">
            {isLogin ? 'Sign up' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  );
}
