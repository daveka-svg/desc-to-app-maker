import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import logo from "@/assets/logo.png";
import { LayoutDashboard, Settings, LogOut } from "lucide-react";

const DashboardLayout = ({ children }: { children: React.ReactNode }) => {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 px-3 py-2 rounded-full text-xs uppercase tracking-widest font-semibold transition-colors ${
      isActive ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
    }`;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="w-full border-b border-border bg-white">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <a href="https://everytailvets.co.uk/" target="_blank" rel="noopener noreferrer">
              <img src={logo} alt="Every Tail Vets" className="h-8 object-contain" />
            </a>
            <nav className="hidden md:flex items-center gap-1">
              <NavLink to="/" end className={linkClass}>
                <LayoutDashboard className="w-4 h-4" /> Submissions
              </NavLink>
              <NavLink to="/settings" className={linkClass}>
                <Settings className="w-4 h-4" /> Practice Settings
              </NavLink>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground hidden sm:inline">{profile?.name || profile?.email}</span>
            <button onClick={handleSignOut} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <LogOut className="w-3.5 h-3.5" /> Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-6">
        {children}
      </main>
    </div>
  );
};

export default DashboardLayout;
