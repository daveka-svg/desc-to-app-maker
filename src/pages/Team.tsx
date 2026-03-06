import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Plus, Trash2, Loader2, Shield, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

interface AllowedUser {
  id: string;
  email: string;
  display_name: string | null;
  created_at: string;
}

export default function Team() {
  const [users, setUsers] = useState<AllowedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    checkAdminAndLoad();
  }, []);

  const checkAdminAndLoad = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: adminCheck } = await supabase.rpc('is_admin', { _user_id: user.id });
    setIsAdmin(!!adminCheck);

    if (adminCheck) {
      await loadUsers();
    }
    setLoading(false);
  };

  const loadUsers = async () => {
    const { data, error } = await supabase
      .from('allowed_users')
      .select('*')
      .order('created_at', { ascending: true });
    if (data && !error) setUsers(data as AllowedUser[]);
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = newEmail.trim().toLowerCase();
    if (!email) return;

    if (users.some(u => u.email.toLowerCase() === email)) {
      toast({ title: 'Already invited', description: 'This email is already on the list.', variant: 'destructive' });
      return;
    }

    setAdding(true);
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase
      .from('allowed_users')
      .insert({
        email,
        display_name: newName.trim() || null,
        invited_by: user?.id,
      });

    if (error) {
      toast({ title: 'Failed to invite', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'User invited', description: `${email} can now sign in with Google.` });
      setNewEmail('');
      setNewName('');
      await loadUsers();
    }
    setAdding(false);
  };

  const handleRemove = async (user: AllowedUser) => {
    if (user.email === 'veronika@everytailvets.co.uk') {
      toast({ title: 'Cannot remove admin', description: 'The primary admin cannot be removed.', variant: 'destructive' });
      return;
    }
    if (!window.confirm(`Remove ${user.email} from the team?`)) return;

    const { error } = await supabase.from('allowed_users').delete().eq('id', user.id);
    if (error) {
      toast({ title: 'Failed to remove', description: error.message, variant: 'destructive' });
    } else {
      setUsers(prev => prev.filter(u => u.id !== user.id));
      toast({ title: 'User removed', description: `${user.email} no longer has access.` });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream">
        <Loader2 className="animate-spin text-forest" size={24} />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream">
        <div className="text-center">
          <Shield className="mx-auto mb-3 text-text-muted" size={32} />
          <h2 className="text-lg font-semibold text-text-primary mb-1">Admin access required</h2>
          <p className="text-sm text-text-muted mb-4">Only the admin can manage team members.</p>
          <Link to="/" className="text-forest text-sm font-medium hover:underline">Back to Scribe</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-cream">
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[600px] mx-auto px-8 py-8">
          <div className="flex items-center gap-3 mb-6">
            <Link to="/" className="flex items-center gap-2 text-[13px] font-semibold text-forest hover:text-forest-dark transition-colors no-underline">
              <ArrowLeft size={16} /> Back to Scribe
            </Link>
          </div>

          <div className="flex items-center gap-2 mb-1">
            <Users size={20} className="text-bark" />
            <h1 className="text-[22px] font-bold text-bark">Team Management</h1>
          </div>
          <p className="text-sm text-text-muted mb-8">Invite or remove team members who can access ETV Scribe</p>

          {/* Invite form */}
          <div className="bg-card rounded-lg border border-border p-5 mb-6">
            <h3 className="text-[14px] font-semibold text-text-primary mb-3">Invite a new team member</h3>
            <form onSubmit={handleInvite} className="flex gap-2 items-end">
              <div className="flex-1">
                <label className="text-xs font-medium text-text-muted mb-1 block">Email</label>
                <Input
                  type="email"
                  required
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  placeholder="name@everytailvets.co.uk"
                  className="text-sm"
                />
              </div>
              <div className="w-40">
                <label className="text-xs font-medium text-text-muted mb-1 block">Name (optional)</label>
                <Input
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="Dr. Smith"
                  className="text-sm"
                />
              </div>
              <Button type="submit" className="bg-forest hover:bg-forest-dark" disabled={adding}>
                {adding ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                <span className="ml-1">Invite</span>
              </Button>
            </form>
          </div>

          {/* Team list */}
          <div className="bg-card rounded-lg border border-border">
            <div className="px-5 py-3 border-b border-border">
              <h3 className="text-[14px] font-semibold text-text-primary">
                Approved team members ({users.length})
              </h3>
            </div>
            <div className="divide-y divide-border">
              {users.map(user => (
                <div key={user.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <div className="text-sm font-medium text-text-primary">
                      {user.display_name || user.email.split('@')[0]}
                      {user.email === 'veronika@everytailvets.co.uk' && (
                        <span className="ml-2 text-[10px] font-bold bg-forest/10 text-forest px-1.5 py-0.5 rounded">ADMIN</span>
                      )}
                    </div>
                    <div className="text-xs text-text-muted">{user.email}</div>
                  </div>
                  {user.email !== 'veronika@everytailvets.co.uk' && (
                    <button
                      onClick={() => handleRemove(user)}
                      className="text-text-muted hover:text-red-500 transition-colors p-1"
                      title="Remove user"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
