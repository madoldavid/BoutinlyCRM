import React, { useEffect, useRef, useMemo, useState } from 'react';
import {
  LayoutDashboard,
  Users,
  Briefcase,
  CheckSquare,
  Mail,
  Sliders,
  ShieldCheck,
  Grid3X3,
  Search,
  ArrowRight,
  Star,
} from 'lucide-react';

interface AppItem {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  colorClass: string;
  roles?: string[];
}

interface AppLauncherProps {
  apps: AppItem[];
  activeAppId: string;
  onSelect: (appId: string) => void;
  currentUserRole: string;
}

export default function AppLauncher({ apps, activeAppId, onSelect, currentUserRole }: AppLauncherProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const filteredApps = useMemo(() => {
    const authorized = apps.filter(a => !a.roles || a.roles.includes(currentUserRole));
    if (!search.trim()) return authorized;
    const q = search.toLowerCase();
    return authorized.filter(a => a.label.toLowerCase().includes(q) || a.description.toLowerCase().includes(q));
  }, [apps, search, currentUserRole]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        setOpen(false);
        btnRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  useEffect(() => {
    if (open) {
      const input = ref.current?.querySelector('input');
      const timer = setTimeout(() => input?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [open]);

  if (apps.length === 0) return null;

  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={() => setOpen(!open)}
        className="p-1.5 text-theme-secondary hover:text-theme-primary hover:bg-theme-hover rounded-md cursor-pointer bg-transparent border-none transition-colors"
        aria-label="App launcher"
        aria-expanded={open}
        title="App Launcher"
      >
        <Grid3X3 className="w-4 h-4" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-[88]" onClick={() => setOpen(false)} />
          <div
            ref={ref}
            className="absolute right-0 top-full mt-2 w-[340px] bg-theme-card rounded-[14px] shadow-overlay border border-theme-border animate-overlay-in z-[89] overflow-hidden"
            role="dialog"
            aria-label="App launcher"
          >
            {/* Search */}
            <div className="p-3 border-b border-theme-border">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-theme-secondary/50" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search apps..."
                  className="w-full bg-theme-inset text-theme-primary text-xs border border-theme-border rounded-md pl-8 pr-3 py-2 placeholder:text-theme-secondary/50 focus:border-theme-accent transition-colors font-sans"
                />
              </div>
            </div>

            {/* App grid */}
            <div className="p-3">
              {filteredApps.length === 0 ? (
                <p className="text-xs text-theme-secondary text-center py-4">No apps found</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {filteredApps.map(app => (
                    <button
                      key={app.id}
                      onClick={() => { onSelect(app.id); setOpen(false); }}
                      className={`flex items-start gap-2.5 p-2.5 rounded-lg text-left cursor-pointer transition-colors border ${
                        activeAppId === app.id
                          ? 'bg-theme-accent-soft border-theme-accent/30'
                          : 'bg-theme-inset/40 border-transparent hover:bg-theme-hover hover:border-theme-border'
                      }`}
                    >
                      <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${app.colorClass}`}>
                        {app.icon}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-theme-primary font-sans truncate">{app.label}</p>
                        <p className="text-[10px] text-theme-secondary mt-0.5 leading-snug line-clamp-2">{app.description}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export function getDefaultApps(activeModule: string, navigate: (id: string) => void) {
  return [
    {
      id: 'dashboard',
      label: 'Dashboards',
      description: 'KPIs, reports, pipeline analytics and AI insights',
      icon: <LayoutDashboard className="w-4 h-4" />,
      colorClass: 'bg-info-soft text-info',
    },
    {
      id: 'contacts',
      label: 'Contacts',
      description: 'Contacts, accounts, and relationship management',
      icon: <Users className="w-4 h-4" />,
      colorClass: 'bg-success-soft text-success',
    },
    {
      id: 'deals',
      label: 'Pipeline',
      description: 'Sales deals, kanban board, and opportunity tracking',
      icon: <Briefcase className="w-4 h-4" />,
      colorClass: 'bg-accent-soft text-theme-accent',
    },
    {
      id: 'tasks',
      label: 'Tasks',
      description: 'Activities, to-dos, call logging, and calendar',
      icon: <CheckSquare className="w-4 h-4" />,
      colorClass: 'bg-warning-soft text-warning',
    },
    {
      id: 'emails',
      label: 'Email',
      description: 'Email templates, campaigns, and outbox',
      icon: <Mail className="w-4 h-4" />,
      colorClass: 'bg-danger-soft text-danger',
    },
    {
      id: 'admin',
      label: 'Admin',
      description: 'Users, custom fields, audit logs, and system setup',
      icon: <Sliders className="w-4 h-4" />,
      colorClass: 'bg-theme-inset text-theme-secondary',
      roles: ['super_admin', 'admin'],
    },
  ];
}
