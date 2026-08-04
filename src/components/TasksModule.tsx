/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useCRM } from '../store';
import { Task, UserRole } from '../types';
import {
  CheckSquare,
  Square,
  Clock,
  Calendar as CalendarIcon,
  Plus,
  Trash2,
  CheckCircle,
  Phone,
  Users,
  Briefcase,
  AlertCircle,
  Info,
  Sparkles
} from 'lucide-react';
import { NEW_RECORD_EVENT, SELECT_ENTITY_EVENT, type SelectEntityDetail } from './GlobalShortcuts';
import { relativeDueLabel, formatDateTime } from '../utils/time';

export default function TasksModule() {
  const {
    currentUser,
    users,
    contacts,
    deals,
    getScopedTasks,
    addTask,
    updateTask,
    completeTask,
    deleteTask,
    addActivity,
  } = useCRM();

  const [activeSubView, setActiveSubView] = useState<'list' | 'calendar' | 'call-logger'>('list');
  const [taskFilter, setTaskFilter] = useState<'all' | 'open' | 'completed' | 'overdue'>('open');

  // Integrations Sync state
  const [googleSync, setGoogleSync] = useState(true);
  const [outlookSync, setOutlookSync] = useState(false);

  // Forms
  const [showCreateTask, setShowCreateTask] = useState(false);

  // "n" shortcut → open create-task modal
  useEffect(() => {
    const onNewRecord = () => setShowCreateTask(true);
    window.addEventListener(NEW_RECORD_EVENT, onNewRecord);
    return () => window.removeEventListener(NEW_RECORD_EVENT, onNewRecord);
  }, []);

  // Deep-link from AI next-best-action → surface overdue task
  useEffect(() => {
    const onSelect = (e: Event) => {
      const detail = (e as CustomEvent<SelectEntityDetail>).detail;
      if (!detail || detail.module !== 'tasks') return;
      setTaskFilter('overdue');
    };
    window.addEventListener(SELECT_ENTITY_EVENT, onSelect);
    return () => window.removeEventListener(SELECT_ENTITY_EVENT, onSelect);
  }, []);
  const [taskForm, setTaskForm] = useState({
    title: '',
    type: 'todo' as Task['type'],
    priority: 'medium' as Task['priority'],
    due_at: '2026-07-15T09:00',
    assigned_to_id: currentUser.id,
    contact_id: '',
    deal_id: '',
    recurrence: 'none'
  });

  // Call logger form
  const [callForm, setCallForm] = useState({
    contact_id: '',
    deal_id: '',
    duration_minutes: 5,
    outcome: 'connected',
    summary_notes: ''
  });

  const [callSuccessMessage, setCallSuccessMessage] = useState('');

  const scopedTasks = getScopedTasks();

  const isOverdue = (t: Task) => {
    return !t.completed_at && new Date(t.due_at) < new Date();
  };

  const filteredTasks = scopedTasks.filter(t => {
    if (taskFilter === 'all') return true;
    if (taskFilter === 'open') return !t.completed_at;
    if (taskFilter === 'completed') return !!t.completed_at;
    if (taskFilter === 'overdue') return isOverdue(t);
    return true;
  });

  // Sort tasks: high priority first, then due date
  const sortedTasks = [...filteredTasks].sort((a, b) => {
    if (a.completed_at && !b.completed_at) return 1;
    if (!a.completed_at && b.completed_at) return -1;
    
    // Sort priority
    const priorityWeight = { high: 3, medium: 2, low: 1 };
    const pA = priorityWeight[a.priority];
    const pB = priorityWeight[b.priority];
    if (pA !== pB) return pB - pA;

    return new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
  });

  // Handle task creation
  const handleTaskSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addTask({
      title: taskForm.title,
      type: taskForm.type,
      priority: taskForm.priority,
      due_at: new Date(taskForm.due_at).toISOString(),
      assigned_to_id: taskForm.assigned_to_id,
      contact_id: taskForm.contact_id || undefined,
      deal_id: taskForm.deal_id || undefined,
      recurrence_rule: taskForm.recurrence !== 'none' ? `FREQ=${taskForm.recurrence.toUpperCase()}` : undefined
    });
    setShowCreateTask(false);
    // Reset
    setTaskForm({
      title: '',
      type: 'todo',
      priority: 'medium',
      due_at: '2026-07-15T09:00',
      assigned_to_id: currentUser.id,
      contact_id: '',
      deal_id: '',
      recurrence: 'none'
    });
  };

  // Handle call logger submission
  const handleLogCallSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const contact = contacts.find(c => c.id === callForm.contact_id);

    addActivity({
      type: 'call',
      title: `Outgoing Call Logged with ${contact ? contact.first_name : 'Representative'}`,
      body: `Duration: ${callForm.duration_minutes} minutes. Outcome: ${callForm.outcome}. Notes: ${callForm.summary_notes}`,
      user_id: currentUser.id,
      contact_id: callForm.contact_id || undefined,
      deal_id: callForm.deal_id || undefined,
      outcome: callForm.outcome,
      duration_seconds: callForm.duration_minutes * 60,
    });

    setCallForm({
      contact_id: '',
      deal_id: '',
      duration_minutes: 5,
      outcome: 'connected',
      summary_notes: ''
    });

    setCallSuccessMessage('Call activity successfully compiled and appended to chronological audit and customer timeline.');
    setTimeout(() => {
      setCallSuccessMessage('');
    }, 4000);
  };

  // Dynamic calendar for current month
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
  const calendarDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
  const dayHeaders = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Rotate dayHeaders so the first column matches the first day of the month
  const rotatedDayHeaders = [
    ...dayHeaders.slice(firstDayOfMonth),
    ...dayHeaders.slice(0, firstDayOfMonth),
  ];

  const getTasksForDay = (dayNum: number) => {
    return scopedTasks.filter(t => {
      const d = new Date(t.due_at);
      return d.getMonth() === currentMonth && d.getDate() === dayNum && d.getFullYear() === currentYear;
    });
  };

  const isReadOnly = currentUser.role === UserRole.VIEWER;

  return (
    <div className="flex-1 flex overflow-hidden bg-theme-base text-theme-primary">
      
      {/* LEFT COLUMN: MAIN WORKSPACE */}
      <div className="w-1/2 flex flex-col border-r border-theme-border bg-theme-card h-full select-none">
        
        {/* Module Header Toolbar */}
        <div className="p-4 border-b border-theme-border space-y-3.5 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 bg-theme-base p-0.5 rounded-lg border border-theme-border text-xs font-semibold">
              <button
                onClick={() => setActiveSubView('list')}
                className={`px-3 py-1.5 rounded-md cursor-pointer transition-all flex items-center gap-1.5 ${
                  activeSubView === 'list' ? 'bg-theme-card text-theme-primary shadow-xs border border-theme-border/50' : 'text-theme-secondary hover:text-theme-primary'
                }`}
              >
                <CheckSquare className="w-3.5 h-3.5 text-theme-accent" /> Tasks List
              </button>
              <button
                onClick={() => setActiveSubView('calendar')}
                className={`px-3 py-1.5 rounded-md cursor-pointer transition-all flex items-center gap-1.5 ${
                  activeSubView === 'calendar' ? 'bg-theme-card text-theme-primary shadow-xs border border-theme-border/50' : 'text-theme-secondary hover:text-theme-primary'
                }`}
              >
                <CalendarIcon className="w-3.5 h-3.5 text-theme-accent" /> Calendar View
              </button>
              <button
                onClick={() => setActiveSubView('call-logger')}
                className={`px-3 py-1.5 rounded-md cursor-pointer transition-all flex items-center gap-1.5 ${
                  activeSubView === 'call-logger' ? 'bg-theme-card text-theme-primary shadow-xs border border-theme-border/50' : 'text-theme-secondary hover:text-theme-primary'
                }`}
              >
                <Phone className="w-3.5 h-3.5 text-theme-accent" /> Log Call Activity
              </button>
            </div>

            {!isReadOnly && activeSubView === 'list' && (
              <button
                onClick={() => setShowCreateTask(true)}
                className="bg-theme-accent hover:opacity-90 text-white px-3 py-1.5 rounded-lg flex items-center gap-1 text-xs font-semibold shadow-xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Task
              </button>
            )}
          </div>

          {/* Sub Tab Filter selectors for List */}
          {activeSubView === 'list' && (
            <div className="flex gap-1.5 text-[11px] font-semibold text-theme-secondary">
              <button
                onClick={() => setTaskFilter('open')}
                className={`px-2.5 py-1 rounded-md cursor-pointer ${taskFilter === 'open' ? 'bg-theme-primary text-theme-card' : 'hover:bg-theme-base'}`}
              >
                Active Tasks
              </button>
              <button
                onClick={() => setTaskFilter('overdue')}
                className={`px-2.5 py-1 rounded-md cursor-pointer text-theme-accent flex items-center gap-1 ${taskFilter === 'overdue' ? 'bg-theme-accent/10 font-bold border border-theme-accent/30' : 'hover:bg-theme-base'}`}
              >
                <AlertCircle className="w-3.5 h-3.5" /> Overdue
              </button>
              <button
                onClick={() => setTaskFilter('completed')}
                className={`px-2.5 py-1 rounded-md cursor-pointer ${taskFilter === 'completed' ? 'bg-theme-primary text-theme-card' : 'hover:bg-theme-base'}`}
              >
                Completed
              </button>
              <button
                onClick={() => setTaskFilter('all')}
                className={`px-2.5 py-1 rounded-md cursor-pointer ${taskFilter === 'all' ? 'bg-theme-primary text-theme-card' : 'hover:bg-theme-base'}`}
              >
                All Scoped
              </button>
            </div>
          )}
        </div>

        {/* WORKSPACE SUB VIEW: TASKS LIST */}
        {activeSubView === 'list' && (
          <div className="flex-1 overflow-y-auto divide-y divide-theme-border">
            {sortedTasks.length === 0 ? (
              <p className="p-8 text-center text-xs text-theme-secondary/70 font-sans">No tasks in this list.</p>
            ) : (
              sortedTasks.map(task => {
                const assignedUser = users.find(u => u.id === task.assigned_to_id);
                const linkedContact = contacts.find(c => c.id === task.contact_id);
                const linkedDeal = deals.find(d => d.id === task.deal_id);

                return (
                  <div
                    key={task.id}
                    className={`p-4 flex items-start gap-3 text-left transition-colors hover:bg-theme-base/40 ${
                      task.completed_at ? 'bg-theme-base/30 opacity-60' : ''
                    }`}
                  >
                    {/* Checkbox trigger completion */}
                    {!isReadOnly && !task.completed_at ? (
                      <button
                        onClick={() => {
                          const note = prompt('Add an optional completion follow-up note:');
                          completeTask(task.id, note || undefined);
                        }}
                        className="text-theme-secondary/80 hover:text-theme-accent shrink-0 mt-0.5 cursor-pointer bg-transparent border-none p-0"
                        title="Mark Completed"
                      >
                        <Square className="w-4.5 h-4.5" />
                      </button>
                    ) : (
                      <CheckCircle className="w-4.5 h-4.5 text-theme-secondary/40 shrink-0 mt-0.5" />
                    )}

                    <div className="flex-1 min-w-0">
                      <h4 className={`text-xs font-bold leading-snug ${task.completed_at ? 'line-through text-theme-secondary/60' : 'text-theme-primary'}`}>
                        {task.title}
                      </h4>
                      
                      {/* Attached records */}
                      <div className="flex items-center gap-2 mt-1.5 text-[10px] text-theme-secondary flex-wrap">
                        {linkedContact && (
                          <span className="flex items-center gap-0.5 bg-theme-base text-theme-primary border border-theme-border px-1.5 py-0.2 rounded font-sans font-medium">
                            <Users className="w-2.5 h-2.5 text-theme-accent" /> {linkedContact.first_name} {linkedContact.last_name}
                          </span>
                        )}
                        {linkedDeal && (
                          <span className="flex items-center gap-0.5 bg-theme-base text-theme-primary border border-theme-border px-1.5 py-0.2 rounded font-sans font-medium">
                            <Briefcase className="w-2.5 h-2.5 text-theme-accent" /> {linkedDeal.name}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between mt-3 text-[9px] text-theme-secondary font-sans">
                        <span
                          className={`flex items-center gap-1 font-semibold ${
                            task.completed_at ? '' :
                            (() => {
                              const rel = relativeDueLabel(task.due_at, currentUser?.timezone);
                              if (rel.tone === 'overdue') return 'text-danger';
                              if (rel.tone === 'soon') return 'text-warning';
                              return '';
                            })()
                          }`}
                          title={formatDateTime(task.due_at, currentUser?.timezone)}
                        >
                          <Clock className="w-3 h-3" />
                          {task.completed_at
                            ? 'completed'
                            : `Due: ${relativeDueLabel(task.due_at, currentUser?.timezone).text}`}
                        </span>
                        
                        <div className="flex items-center gap-1.5 uppercase font-bold tracking-wider">
                          <span className={`px-1 py-0.2 rounded ${
                            task.priority === 'high' ? 'bg-theme-accent/10 text-theme-accent border border-theme-accent/20' : task.priority === 'medium' ? 'bg-theme-accent/5 text-theme-secondary border border-theme-border' : 'bg-theme-base text-theme-secondary border border-theme-border'
                          }`}>
                            {task.priority} Priority
                          </span>
                          <span>• Owner: {assignedUser?.name || 'Unassigned'}</span>
                        </div>
                      </div>
                    </div>

                    {!isReadOnly && (
                      <button
                        onClick={() => deleteTask(task.id)}
                        className="p-1 text-theme-secondary/50 hover:text-theme-accent rounded transition-colors cursor-pointer bg-transparent border-none"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* WORKSPACE SUB VIEW: CALENDAR */}
        {activeSubView === 'calendar' && (
          <div className="flex-1 overflow-y-auto p-4 flex flex-col h-full bg-theme-base text-left">
            <div className="flex justify-between items-center bg-theme-card p-3 border border-theme-border rounded-xl mb-4 shadow-2xs">
              <span className="font-bold text-xs text-theme-primary flex items-center gap-1">
                <CalendarIcon className="w-4 h-4 text-theme-accent" /> {monthNames[currentMonth]} {currentYear}
              </span>
              <span className="text-[10px] text-theme-secondary font-sans">Month Agenda Overview</span>
            </div>

            {/* Calendar Grid 7 Columns */}
            <div className="grid grid-cols-7 gap-1.5 text-center text-[10px] font-bold text-theme-secondary font-sans uppercase mb-1">
              {rotatedDayHeaders.map(d => <div key={d}>{d}</div>)}
            </div>

            <div className="grid grid-cols-7 gap-1.5 flex-1">
              {calendarDays.map(day => {
                const dayTasks = getTasksForDay(day);

                return (
                  <div key={day} className="bg-theme-card p-2 border border-theme-border rounded-lg min-h-16 flex flex-col justify-between hover:border-theme-accent/30 transition-all select-none">
                    <span className="text-[10px] font-bold text-theme-secondary font-sans text-left">{day}</span>
                    
                    <div className="mt-1 space-y-0.5">
                      {dayTasks.map(t => (
                        <div 
                          key={t.id} 
                          className={`text-[8px] font-semibold py-0.5 px-1 rounded truncate block text-left ${
                            t.completed_at ? 'bg-theme-base/50 text-theme-secondary/50 line-through border-none' : t.priority === 'high' ? 'bg-theme-accent/15 text-theme-primary border-l-2 border-theme-accent' : 'bg-theme-secondary/15 text-theme-primary border-l-2 border-theme-secondary'
                          }`}
                          title={t.title}
                        >
                          {t.title}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* WORKSPACE SUB VIEW: CALL LOGGER */}
        {activeSubView === 'call-logger' && (
          <div className="flex-1 p-5 overflow-y-auto text-left bg-theme-base">
            <div className="bg-theme-card p-5 rounded-xl border border-theme-border shadow-2xs">
              <h3 className="text-sm font-bold text-theme-primary flex items-center gap-1.5">
                <Phone className="w-4 h-4 text-theme-accent" /> Log Instant Outgoing Call Activity
              </h3>
              <p className="text-xs text-theme-secondary mt-1">Record telephone outcomes and conversation details. Instantly logs into related contact timelines.</p>

              {callSuccessMessage && (
                <div className="p-3 bg-green-500/10 border border-green-500/20 text-green-500 rounded-lg text-xs mt-3 font-sans">
                  {callSuccessMessage}
                </div>
              )}

              <form onSubmit={isReadOnly ? (e) => e.preventDefault() : handleLogCallSubmit} className="space-y-4 text-xs mt-5">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block font-semibold text-theme-secondary">Dialed Contact *</label>
                    <select
                      value={callForm.contact_id}
                      onChange={(e) => setCallForm({ ...callForm, contact_id: e.target.value })}
                      required
                      className="w-full bg-theme-base text-theme-primary border border-theme-border rounded px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-theme-accent"
                    >
                      <option value="" className="bg-theme-card text-theme-primary">-- Select a Contact --</option>
                      {contacts.map(c => <option key={c.id} value={c.id} className="bg-theme-card text-theme-primary">{c.first_name} {c.last_name} ({c.title})</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="block font-semibold text-theme-secondary">Related Deal Opportunity</label>
                    <select
                      value={callForm.deal_id}
                      onChange={(e) => setCallForm({ ...callForm, deal_id: e.target.value })}
                      className="w-full bg-theme-base text-theme-primary border border-theme-border rounded px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-theme-accent"
                    >
                      <option value="" className="bg-theme-card text-theme-primary">-- No Related Opportunity --</option>
                      {deals.map(d => <option key={d.id} value={d.id} className="bg-theme-card text-theme-primary">{d.name}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block font-semibold text-theme-secondary">Duration (Minutes)</label>
                    <input
                      type="number" min="1"
                      value={callForm.duration_minutes}
                      onChange={(e) => setCallForm({ ...callForm, duration_minutes: Number(e.target.value) })}
                      className="w-full bg-theme-base text-theme-primary border border-theme-border rounded px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-theme-accent"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block font-semibold text-theme-secondary">Dial Outcome Outcome *</label>
                    <select
                      value={callForm.outcome}
                      onChange={(e) => setCallForm({ ...callForm, outcome: e.target.value })}
                      className="w-full bg-theme-base text-theme-primary border border-theme-border rounded px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-theme-accent"
                    >
                      <option value="connected" className="bg-theme-card text-theme-primary">Connected / Conversation held</option>
                      <option value="voicemail" className="bg-theme-card text-theme-primary">Voicemail / Message left</option>
                      <option value="no_answer" className="bg-theme-card text-theme-primary">No Answer</option>
                      <option value="busy" className="bg-theme-card text-theme-primary">Busy / Engaged Line</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block font-semibold text-theme-secondary">Summary Conversation Notes *</label>
                  <textarea
                    rows={4} required
                    placeholder="Provide specific details of discussion, questions, objections..."
                    value={callForm.summary_notes}
                    onChange={(e) => setCallForm({ ...callForm, summary_notes: e.target.value })}
                    className="w-full bg-theme-base text-theme-primary border border-theme-border rounded p-2.5 focus:ring-1 focus:ring-theme-accent focus:outline-none"
                  />
                </div>

                <div className="pt-3 border-t border-theme-border flex justify-end">
                  <button
                    type="submit"
                    disabled={isReadOnly}
                    className="bg-theme-accent hover:opacity-90 text-white font-semibold px-4 py-2 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                  >
                    Log Call & timeline record
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>


      {/* RIGHT COLUMN: CALENDAR SYNC CONFIGURATORS */}
      <div className="w-1/2 p-5 overflow-y-auto bg-theme-base text-left space-y-6">
        <div className="bg-theme-card p-5 rounded-xl border border-theme-border shadow-2xs space-y-4">
          <h4 className="text-xs font-bold uppercase font-sans tracking-wider text-theme-secondary flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-theme-accent" /> Bidirectional Calendar Integrations
          </h4>
          <p className="text-xs text-theme-secondary leading-normal">
            Authorize CRM synchronization into external calendar apps. Bi-directional sync keeps meetings and due dates aligned with Outlook or Google.
          </p>

          <div className="space-y-3.5 pt-2">
            
            {/* Google Sync */}
            <div className="p-3.5 bg-theme-base/50 rounded-xl border border-theme-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-theme-card rounded-lg border border-theme-border text-xs font-bold text-theme-accent shadow-2xs font-sans">G</div>
                <div>
                  <h5 className="text-xs font-bold text-theme-primary">Google Calendar Sync</h5>
                  <p className="text-[10px] text-theme-secondary mt-0.5 font-sans">Using OAuth 2.0 • Synchronized 1 minute ago</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="bg-theme-accent/10 text-theme-accent border border-theme-accent/20 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider font-sans">Active</span>
                <button
                  onClick={() => setGoogleSync(!googleSync)}
                  className="text-xs text-theme-accent hover:opacity-85 font-semibold cursor-pointer bg-transparent border-none"
                >
                  {googleSync ? 'Disconnect' : 'Connect'}
                </button>
              </div>
            </div>

            {/* Microsoft Sync */}
            <div className="p-3.5 bg-theme-base/50 rounded-xl border border-theme-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-theme-card rounded-lg border border-theme-border text-xs font-bold text-theme-secondary shadow-2xs font-sans">O</div>
                <div>
                  <h5 className="text-xs font-bold text-theme-primary">Outlook / M365 Calendar</h5>
                  <p className="text-[10px] text-theme-secondary mt-0.5 font-sans">Sync appointments, invites, and notes</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="bg-theme-base border border-theme-border text-theme-secondary px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider font-sans">Offline</span>
                <button
                  onClick={() => setOutlookSync(!outlookSync)}
                  className="text-xs text-theme-accent hover:opacity-85 font-semibold cursor-pointer bg-transparent border-none"
                >
                  {outlookSync ? 'Disconnect' : 'Connect'}
                </button>
              </div>
            </div>

          </div>
        </div>

        {/* Informational Widget */}
        <div className="p-4 bg-theme-card rounded-lg border border-theme-border flex gap-3 text-xs leading-normal">
          <Info className="w-4.5 h-4.5 text-theme-accent shrink-0 mt-0.5" />
          <div className="text-theme-secondary">
            <strong className="text-theme-primary block">Task Reminders & Webhooks</strong>
            High-priority tasks assign notifications directly via email to sales representatives 24 hours prior to deadline dates.
          </div>
        </div>
      </div>


      {/* MODAL: CREATE TASK */}
      {showCreateTask && (
        <div className="fixed inset-0 bg-theme-primary/60 flex items-center justify-center z-50">
          <div className="bg-theme-card rounded-xl shadow-xl border border-theme-border w-full max-w-md overflow-hidden">
            <header className="bg-theme-base px-5 py-4 border-b border-theme-border flex justify-between items-center">
              <h3 className="text-sm font-bold text-theme-primary">Create Scheduled CRM Task</h3>
              <button onClick={() => setShowCreateTask(false)} className="text-theme-secondary hover:text-theme-primary font-bold text-xs cursor-pointer bg-transparent border-none">✕</button>
            </header>
            <form onSubmit={handleTaskSubmit} className="p-5 space-y-4 text-xs text-left">
              <div className="space-y-1">
                <label className="block font-semibold text-theme-secondary">Task Title *</label>
                <input
                  type="text" required placeholder="e.g. Solution deck review"
                  value={taskForm.title}
                  onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                  className="w-full bg-theme-base text-theme-primary rounded border border-theme-border px-2.5 py-1.5 focus:ring-1 focus:ring-theme-accent focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block font-semibold text-theme-secondary">Task Type</label>
                  <select
                    value={taskForm.type}
                    onChange={(e) => setTaskForm({ ...taskForm, type: e.target.value as any })}
                    className="w-full bg-theme-base text-theme-primary rounded border border-theme-border px-2.5 py-1.5 focus:ring-1 focus:ring-theme-accent focus:outline-none"
                  >
                    <option value="todo" className="bg-theme-card text-theme-primary">General To-Do</option>
                    <option value="call" className="bg-theme-card text-theme-primary">Call Representative</option>
                    <option value="meeting" className="bg-theme-card text-theme-primary">Business Meeting</option>
                    <option value="email" className="bg-theme-card text-theme-primary">Send Template Email</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="block font-semibold text-theme-secondary">Task Priority</label>
                  <select
                    value={taskForm.priority}
                    onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value as any })}
                    className="w-full bg-theme-base text-theme-primary rounded border border-theme-border px-2.5 py-1.5 focus:ring-1 focus:ring-theme-accent focus:outline-none"
                  >
                    <option value="low" className="bg-theme-card text-theme-primary">Low Priority</option>
                    <option value="medium" className="bg-theme-card text-theme-primary">Medium Priority</option>
                    <option value="high" className="bg-theme-card text-theme-primary">High Priority</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block font-semibold text-theme-secondary">Due Date & Time *</label>
                  <input
                    type="datetime-local" required
                    value={taskForm.due_at}
                    onChange={(e) => setTaskForm({ ...taskForm, due_at: e.target.value })}
                    className="w-full bg-theme-base text-theme-primary rounded border border-theme-border px-2.5 py-1.5 focus:ring-1 focus:ring-theme-accent focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block font-semibold text-theme-secondary">Assigned Recipient *</label>
                  <select
                    required
                    value={taskForm.assigned_to_id}
                    onChange={(e) => setTaskForm({ ...taskForm, assigned_to_id: e.target.value })}
                    className="w-full bg-theme-base text-theme-primary rounded border border-theme-border px-2.5 py-1.5 focus:ring-1 focus:ring-theme-accent focus:outline-none"
                  >
                    {users.map(u => <option key={u.id} value={u.id} className="bg-theme-card text-theme-primary">{u.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block font-semibold text-theme-secondary">Link Contact Person</label>
                  <select
                    value={taskForm.contact_id}
                    onChange={(e) => setTaskForm({ ...taskForm, contact_id: e.target.value })}
                    className="w-full bg-theme-base text-theme-primary rounded border border-theme-border px-2.5 py-1.5 focus:ring-1 focus:ring-theme-accent focus:outline-none"
                  >
                    <option value="" className="bg-theme-card text-theme-primary">-- No Contact Link --</option>
                    {contacts.map(c => <option key={c.id} value={c.id} className="bg-theme-card text-theme-primary">{c.first_name} {c.last_name}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="block font-semibold text-theme-secondary">Link Opportunity Deal</label>
                  <select
                    value={taskForm.deal_id}
                    onChange={(e) => setTaskForm({ ...taskForm, deal_id: e.target.value })}
                    className="w-full bg-theme-base text-theme-primary rounded border border-theme-border px-2.5 py-1.5 focus:ring-1 focus:ring-theme-accent focus:outline-none"
                  >
                    <option value="" className="bg-theme-card text-theme-primary">-- No Deal Link --</option>
                    {deals.map(d => <option key={d.id} value={d.id} className="bg-theme-card text-theme-primary">{d.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block font-semibold text-theme-secondary">Recurring Schedule</label>
                <select
                  value={taskForm.recurrence}
                  onChange={(e) => setTaskForm({ ...taskForm, recurrence: e.target.value })}
                  className="w-full bg-theme-base text-theme-primary rounded border border-theme-border px-2.5 py-1.5 focus:ring-1 focus:ring-theme-accent focus:outline-none"
                >
                  <option value="none" className="bg-theme-card text-theme-primary">One-time Task</option>
                  <option value="daily" className="bg-theme-card text-theme-primary">Daily Recurrence</option>
                  <option value="weekly" className="bg-theme-card text-theme-primary">Weekly Recurrence</option>
                  <option value="monthly" className="bg-theme-card text-theme-primary">Monthly Recurrence</option>
                </select>
              </div>

              <div className="pt-4 border-t border-theme-border flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateTask(false)}
                  className="px-4 py-2 border border-theme-border hover:bg-theme-base text-theme-primary rounded-lg font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-theme-accent hover:opacity-90 text-white rounded-lg font-semibold cursor-pointer"
                >
                  Create Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
