import React, { useMemo, useState } from 'react';
import {
  Phone,
  CheckCircle2,
  Circle,
  Trash2,
  CalendarDays,
  ClipboardList,
  Plus,
} from 'lucide-react';
import type { CallLog, RecordTask, User } from '../../types';
import { useCRM } from '../../store';
import { Avatar, Button } from './index';
import MentionInput from './MentionInput';

export type TimelineEntityType = 'lead' | 'contact' | 'deal';

interface TimelinePanelProps {
  entityType: TimelineEntityType;
  entityId: string;
  readOnly?: boolean;
  className?: string;
}

type FeedItem =
  | { kind: 'call'; id: string; created_at: string; subject: string; description: string; user_id: string }
  | { kind: 'task'; id: string; created_at: string; subject: string; description: string; user_id: string; due_date?: string; completed_at?: string };

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

const inputClass =
  'w-full bg-theme-base text-theme-primary border border-theme-border rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-theme-accent focus:outline-none';

function TimelinePanel({ entityType, entityId, readOnly = false, className = '' }: TimelinePanelProps) {
  const { currentUser, users, recordTasks, callLogs, addRecordTask, toggleRecordTask, deleteRecordTask, addCallLog } = useCRM();

  const [tab, setTab] = useState<'call' | 'task'>('call');
  const [callSubject, setCallSubject] = useState('');
  const [callNotes, setCallNotes] = useState('');
  const [taskSubject, setTaskSubject] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskDueDate, setTaskDueDate] = useState('');

  const getUserName = (userId: string) => users.find(u => u.id === userId)?.name ?? 'Unknown User';
  const getUser = (userId: string): User | undefined => users.find(u => u.id === userId);

  const feed = useMemo<FeedItem[]>(() => {
    const calls: FeedItem[] = callLogs
      .filter(c => c.associated_to_id === entityId)
      .map(c => ({ kind: 'call', id: c.id, created_at: c.created_at, subject: c.subject, description: c.description, user_id: c.user_id }));
    const tasks: FeedItem[] = recordTasks
      .filter(t => t.associated_to_id === entityId)
      .map(t => ({ kind: 'task', id: t.id, created_at: t.created_at, subject: t.subject, description: t.description, user_id: t.user_id, due_date: t.due_date, completed_at: t.completed_at }));
    return [...calls, ...tasks].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [callLogs, recordTasks, entityId]);

  const grouped = useMemo(() => {
    const groups: { label: string; items: FeedItem[] }[] = [];
    for (const item of feed) {
      const label = formatDateLabel(item.created_at);
      const last = groups[groups.length - 1];
      if (last && last.label === label) last.items.push(item);
      else groups.push({ label, items: [item] });
    }
    return groups;
  }, [feed]);

  const resetCallForm = () => {
    setCallSubject('');
    setCallNotes('');
  };

  const resetTaskForm = () => {
    setTaskSubject('');
    setTaskDescription('');
    setTaskDueDate('');
  };

  const handleLogCall = () => {
    if (!currentUser) return;
    const subject = callSubject.trim() || 'Call logged';
    addCallLog({
      subject,
      description: callNotes.trim(),
      associated_to_id: entityId,
      user_id: currentUser.id,
    });
    resetCallForm();
  };

  const handleAddTask = () => {
    if (!currentUser || !taskSubject.trim()) return;
    addRecordTask({
      subject: taskSubject.trim(),
      description: taskDescription.trim(),
      due_date: taskDueDate ? new Date(taskDueDate).toISOString() : undefined,
      associated_to_id: entityId,
      user_id: currentUser.id,
    });
    resetTaskForm();
  };

  return (
    <div className={className}>
      {!readOnly && (
        <div className="mb-4">
          <div className="flex items-center gap-1 bg-theme-inset/60 border border-theme-border rounded-lg p-1 mb-3">
            <button
              type="button"
              onClick={() => setTab('call')}
              className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium font-sans transition-colors cursor-pointer ${
                tab === 'call' ? 'bg-theme-card text-theme-accent shadow-card' : 'text-theme-secondary hover:text-theme-primary'
              }`}
            >
              <Phone className="w-3.5 h-3.5" />
              Log a Call
            </button>
            <button
              type="button"
              onClick={() => setTab('task')}
              className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium font-sans transition-colors cursor-pointer ${
                tab === 'task' ? 'bg-theme-card text-theme-accent shadow-card' : 'text-theme-secondary hover:text-theme-primary'
              }`}
            >
              <ClipboardList className="w-3.5 h-3.5" />
              Add Task
            </button>
          </div>

          {tab === 'call' ? (
            <div className="space-y-2">
              <input
                type="text"
                value={callSubject}
                onChange={e => setCallSubject(e.target.value)}
                placeholder="Call subject (e.g. Discovery call)"
                className={inputClass}
              />
              <MentionInput
                value={callNotes}
                onChange={setCallNotes}
                placeholder="Notes… Type @ to mention"
                users={users}
                className={inputClass}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleLogCall();
                  }
                }}
              />
              <Button size="sm" className="w-full" icon={<Phone className="w-3.5 h-3.5" />} onClick={handleLogCall}>
                Save Call
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <input
                type="text"
                value={taskSubject}
                onChange={e => setTaskSubject(e.target.value)}
                placeholder="Task subject (e.g. Follow up on proposal)"
                className={inputClass}
              />
              <MentionInput
                value={taskDescription}
                onChange={setTaskDescription}
                placeholder="Details… Type @ to mention"
                users={users}
                className={inputClass}
              />
              <div className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-theme-secondary shrink-0" />
                <input
                  type="date"
                  value={taskDueDate}
                  onChange={e => setTaskDueDate(e.target.value)}
                  className={inputClass}
                />
              </div>
              <Button
                size="sm"
                className="w-full"
                icon={<Plus className="w-3.5 h-3.5" />}
                onClick={handleAddTask}
                disabled={!taskSubject.trim()}
              >
                Add Task
              </Button>
            </div>
          )}
        </div>
      )}

      {feed.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <p className="text-xs text-theme-secondary">No timeline entries yet — log a call or add a task above.</p>
        </div>
      ) : (
        <div className="max-h-[420px] overflow-y-auto pr-1 -mr-1">
          {grouped.map((group, gi) => (
            <div key={gi} className="mb-4 last:mb-0">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xs font-semibold text-theme-secondary uppercase tracking-wider font-sans">{group.label}</span>
                <span className="flex-1 h-px bg-theme-border" />
              </div>
              <div className="space-y-2">
                {group.items.map(item => {
                  const user = getUser(item.user_id);
                  if (item.kind === 'call') {
                    return (
                      <div key={item.id} className="bg-theme-card border border-theme-border rounded-lg p-3 shadow-card">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="shrink-0 w-[26px] h-[26px] rounded-full flex items-center justify-center bg-info-soft text-info">
                              <Phone className="w-3.5 h-3.5" />
                            </div>
                            <Avatar name={getUserName(item.user_id)} src={user?.avatar_url} size="sm" />
                            <span className="text-xs font-semibold text-theme-primary truncate">{getUserName(item.user_id)}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-info-soft text-info font-medium font-sans">Call</span>
                          </div>
                          <span className="text-[10px] text-theme-secondary/70 font-sans whitespace-nowrap shrink-0">{formatTime(item.created_at)}</span>
                        </div>
                        <h4 className="text-sm font-medium text-theme-primary mt-2">{item.subject}</h4>
                        {item.description && (
                          <p className="text-xs text-theme-secondary mt-1 leading-relaxed line-clamp-3">{item.description}</p>
                        )}
                      </div>
                    );
                  }
                  const completed = Boolean(item.completed_at);
                  return (
                    <div key={item.id} className={`bg-theme-card border border-theme-border rounded-lg p-3 shadow-card ${completed ? 'opacity-70' : ''}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <button
                            type="button"
                            onClick={() => !readOnly && toggleRecordTask(item.id)}
                            className={`shrink-0 cursor-pointer bg-transparent border-none p-0 ${
                              completed ? 'text-success' : 'text-theme-secondary hover:text-theme-accent'
                            }`}
                            aria-label={completed ? 'Mark incomplete' : 'Mark complete'}
                            disabled={readOnly}
                          >
                            {completed ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                          </button>
                          <Avatar name={getUserName(item.user_id)} src={user?.avatar_url} size="sm" />
                          <span className="text-xs font-semibold text-theme-primary truncate">{getUserName(item.user_id)}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent-soft text-theme-accent font-medium font-sans">Task</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] text-theme-secondary/70 font-sans whitespace-nowrap">{formatTime(item.created_at)}</span>
                          {!readOnly && (
                            <button
                              type="button"
                              onClick={() => deleteRecordTask(item.id)}
                              className="text-theme-secondary hover:text-danger cursor-pointer bg-transparent border-none p-0"
                              aria-label="Delete task"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                      <h4 className={`text-sm font-medium mt-2 ${completed ? 'line-through text-theme-secondary' : 'text-theme-primary'}`}>{item.subject}</h4>
                      {item.description && (
                        <p className="text-xs text-theme-secondary mt-1 leading-relaxed line-clamp-3">{item.description}</p>
                      )}
                      {item.due_date && (
                        <p className="flex items-center gap-1 text-2xs text-theme-secondary/80 font-sans mt-1.5">
                          <CalendarDays className="w-3 h-3" />
                          Due {new Date(item.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default TimelinePanel;
