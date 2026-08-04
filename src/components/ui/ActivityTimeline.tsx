import React, { useMemo } from 'react';
import {
  Phone,
  Video,
  Mail,
  Edit3,
  GitCommit,
  CheckCircle2,
  Paperclip,
  DollarSign,
  Clock,
  MessageSquare,
  UserPlus,
  Star,
} from 'lucide-react';
import type { Activity, User } from '../../types';
import { Avatar } from './index';

const typeConfig: Record<string, { icon: React.ReactNode; label: string; tone: string }> = {
  call: { icon: <Phone className="w-3.5 h-3.5" />, label: 'Call', tone: 'bg-info-soft text-info' },
  meeting: { icon: <Video className="w-3.5 h-3.5" />, label: 'Meeting', tone: 'bg-accent-soft text-theme-accent' },
  email_sent: { icon: <Mail className="w-3.5 h-3.5" />, label: 'Email', tone: 'bg-warning-soft text-warning' },
  note: { icon: <Edit3 className="w-3.5 h-3.5" />, label: 'Note', tone: 'bg-theme-inset text-theme-secondary' },
  stage_change: { icon: <GitCommit className="w-3.5 h-3.5" />, label: 'Stage Change', tone: 'bg-accent-soft text-theme-accent' },
  task_completed: { icon: <CheckCircle2 className="w-3.5 h-3.5" />, label: 'Task Done', tone: 'bg-success-soft text-success' },
  file_uploaded: { icon: <Paperclip className="w-3.5 h-3.5" />, label: 'File', tone: 'bg-theme-inset text-theme-secondary' },
  deal_closed: { icon: <DollarSign className="w-3.5 h-3.5" />, label: 'Deal Closed', tone: 'bg-success-soft text-success' },
};

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHrs < 24) return `${diffHrs}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dateDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.floor((today.getTime() - dateDay.getTime()) / 86400000);

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

interface ActivityTimelineProps {
  activities: Activity[];
  users: User[];
  emptyMessage?: string;
  maxItems?: number;
  className?: string;
}

function ActivityTimeline({ activities, users, emptyMessage, maxItems, className = '' }: ActivityTimelineProps) {
  const getUserName = (userId: string) => users.find(u => u.id === userId)?.name ?? 'Unknown User';

  const grouped = useMemo(() => {
    const sorted = [...activities].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const limited = maxItems ? sorted.slice(0, maxItems) : sorted;
    const groups: { label: string; items: Activity[] }[] = [];
    for (const a of limited) {
      const label = formatDateLabel(a.created_at);
      const last = groups[groups.length - 1];
      if (last && last.label === label) {
        last.items.push(a);
      } else {
        groups.push({ label, items: [a] });
      }
    }
    return groups;
  }, [activities, maxItems]);

  if (activities.length === 0) {
    return (
      <div className={`flex flex-col items-center justify-center py-8 text-center ${className}`}>
        <Clock className="w-8 h-8 text-theme-secondary/30 mb-2" />
        <p className="text-xs text-theme-secondary">{emptyMessage || 'No activities yet'}</p>
      </div>
    );
  }

  return (
    <div className={className}>
      {grouped.map((group, gi) => (
        <div key={gi} className="mb-4 last:mb-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xs font-semibold text-theme-secondary uppercase tracking-wider font-sans">{group.label}</span>
            <span className="flex-1 h-px bg-theme-border" />
          </div>
          <div className="space-y-px relative ml-1">
            {group.items.map((a, i) => {
              const config = typeConfig[a.type] || typeConfig.note;
              const userName = getUserName(a.user_id);
              const user = users.find(u => u.id === a.user_id);
              const isLastInGroup = i === group.items.length - 1;

              return (
                <div key={a.id} className="flex gap-3 relative">
                  {/* Timeline connector line */}
                  {!isLastInGroup && (
                    <div className="absolute left-[15px] top-9 bottom-0 w-px bg-theme-border" aria-hidden="true" />
                  )}
                  {/* Activity type icon */}
                  <div className={`shrink-0 w-[30px] h-[30px] rounded-full flex items-center justify-center relative z-10 border-2 border-theme-card ${config.tone}`}>
                    {config.icon}
                  </div>
                  {/* Content */}
                  <div className="flex-1 min-w-0 pb-3">
                    <div className="bg-theme-card border border-theme-border rounded-lg p-3 shadow-card hover:shadow-raised transition-shadow">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <Avatar name={userName} src={user?.avatar_url} size="sm" />
                          <span className="text-xs font-semibold text-theme-primary truncate">{userName}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium font-sans ${config.tone}`}>
                            {config.label}
                          </span>
                        </div>
                        <span className="text-[10px] text-theme-secondary/70 font-sans whitespace-nowrap shrink-0">
                          {formatTime(a.created_at)}
                        </span>
                      </div>
                      <h4 className="text-sm font-medium text-theme-primary mt-1.5">{a.title}</h4>
                      {a.body && (
                        <p className="text-xs text-theme-secondary mt-1 leading-relaxed line-clamp-3">{a.body}</p>
                      )}
                      {a.outcome && (
                        <div className="mt-2 pt-2 border-t border-theme-border">
                          <span className="text-2xs text-theme-secondary font-sans">Outcome: </span>
                          <span className="text-2xs font-medium text-theme-primary font-sans">{a.outcome}</span>
                        </div>
                      )}
                      {a.duration_seconds && (
                        <div className="flex items-center gap-1 mt-1 text-2xs text-theme-secondary/70 font-sans">
                          <Clock className="w-3 h-3" />
                          {Math.floor(a.duration_seconds / 60)}m {a.duration_seconds % 60}s
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export default ActivityTimeline;
