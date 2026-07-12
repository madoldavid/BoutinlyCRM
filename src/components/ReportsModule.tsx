/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useCRM } from '../store';
import { UserRole, Deal, Task } from '../types';
import { 
  TrendingUp, 
  DollarSign, 
  Percent, 
  ListTodo, 
  BarChart3, 
  PieChart, 
  GitPullRequest, 
  FileDown, 
  Sparkles,
  RefreshCw
} from 'lucide-react';

export default function ReportsModule() {
  const { 
    currentUser, 
    getScopedDeals, 
    getScopedTasks, 
    getScopedActivities,
    accounts,
    contacts,
    users,
    stages
  } = useCRM();

  const [activeSubTab, setActiveSubTab] = useState<'dash' | 'health' | 'winloss' | 'builder'>('dash');

  // Custom Report Builder States
  const [reportEntity, setReportEntity] = useState<'contact' | 'account' | 'deal' | 'task'>('deal');
  const [reportGrouping, setReportGrouping] = useState<string>('owner_id');
  const [reportMetric, setReportMetric] = useState<'count' | 'sum_value'>('sum_value');
  const [reportResult, setReportResult] = useState<any[]>([]);
  const [reportGenerated, setReportGenerated] = useState(false);

  const scopedDeals = getScopedDeals();
  const scopedTasks = getScopedTasks();
  const scopedActivities = getScopedActivities();

  // Metrics Calculations
  const wonDeals = scopedDeals.filter(d => {
    const stage = stages.find(s => s.id === d.stage_id);
    return stage?.type === 'won';
  });

  const lostDeals = scopedDeals.filter(d => {
    const stage = stages.find(s => s.id === d.stage_id);
    return stage?.type === 'lost';
  });

  const openDeals = scopedDeals.filter(d => {
    const stage = stages.find(s => s.id === d.stage_id);
    return stage?.type === 'open';
  });

  const totalClosedDealsCount = wonDeals.length + lostDeals.length;
  const winRate = totalClosedDealsCount > 0 ? (wonDeals.length / totalClosedDealsCount) * 100 : 0;

  const totalOpenValue = openDeals.reduce((sum, d) => sum + d.value, 0);
  const totalWonValue = wonDeals.reduce((sum, d) => sum + d.value, 0);

  // Rep Quota Attainment (Dave has a quota of $1,000,000 for Q3 2026)
  const personalQuota = 1000000;
  const repQuotaAttainment = (totalWonValue / personalQuota) * 100;

  // Render personal or manager views based on role
  const isManagerOrAdmin = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER].includes(currentUser.role);

  // Generate Custom Report Trigger
  const handleGenerateReport = () => {
    setReportGenerated(true);
    let results: any[] = [];
    
    if (reportEntity === 'deal') {
      // Group deals
      const groups: Record<string, Deal[]> = {};
      scopedDeals.forEach(d => {
        let key = '';
        if (reportGrouping === 'owner_id') {
          key = users.find(u => u.id === d.owner_id)?.name || 'Unknown Rep';
        } else if (reportGrouping === 'stage_id') {
          key = stages.find(s => s.id === d.stage_id)?.name || 'Unknown Stage';
        } else if (reportGrouping === 'account_id') {
          key = accounts.find(a => a.id === d.account_id)?.name || 'Unknown Account';
        }
        if (!groups[key]) groups[key] = [];
        groups[key].push(d);
      });

      results = Object.entries(groups).map(([groupName, items]) => {
        const count = items.length;
        const totalVal = items.reduce((sum, i) => sum + i.value, 0);
        return {
          groupName,
          count,
          value: totalVal
        };
      });
    } else if (reportEntity === 'contact') {
      // Group contacts
      const groups: Record<string, any[]> = {};
      contacts.forEach(c => {
        let key = '';
        if (reportGrouping === 'owner_id') {
          key = users.find(u => u.id === c.owner_id)?.name || 'Unknown Rep';
        } else if (reportGrouping === 'account_id') {
          key = accounts.find(a => a.id === c.account_id)?.name || 'Unassigned Account';
        }
        if (!groups[key]) groups[key] = [];
        groups[key].push(c);
      });

      results = Object.entries(groups).map(([groupName, items]) => ({
        groupName,
        count: items.length,
        value: 0
      }));
    } else if (reportEntity === 'task') {
      // Group tasks
      const groups: Record<string, Task[]> = {};
      scopedTasks.forEach(t => {
        let key = '';
        if (reportGrouping === 'owner_id') {
          key = users.find(u => u.id === t.assigned_to_id)?.name || 'Unknown User';
        } else if (reportGrouping === 'type') {
          key = t.type.toUpperCase();
        }
        if (!groups[key]) groups[key] = [];
        groups[key].push(t);
      });

      results = Object.entries(groups).map(([groupName, items]) => ({
        groupName,
        count: items.length,
        value: 0
      }));
    }

    setReportResult(results);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-theme-base text-theme-primary">
      {/* Module Title Section */}
      <header className="bg-theme-card border-b border-theme-border px-6 py-4 shrink-0 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-theme-primary flex items-center gap-2">
            <TrendingUp className="w-5.5 h-5.5 text-theme-accent" />
            Reports & Analytics
          </h2>
          <p className="text-xs text-theme-secondary mt-0.5">Real-time revenue forecast, team targets, and performance pipeline snapshots.</p>
        </div>
        
        {/* Sub Navigation tabs */}
        <div className="flex items-center gap-1.5 bg-theme-base p-1 rounded-lg border border-theme-border text-xs font-medium">
          <button
            onClick={() => setActiveSubTab('dash')}
            className={`px-3 py-1.5 rounded-md cursor-pointer transition-all ${
              activeSubTab === 'dash' ? 'bg-theme-card text-theme-primary shadow-xs border border-theme-border/50' : 'text-theme-secondary hover:text-theme-primary'
            }`}
          >
            {isManagerOrAdmin ? 'Team Dashboard' : 'My Performance'}
          </button>
          <button
            onClick={() => setActiveSubTab('health')}
            className={`px-3 py-1.5 rounded-md cursor-pointer transition-all ${
              activeSubTab === 'health' ? 'bg-theme-card text-theme-primary shadow-xs border border-theme-border/50' : 'text-theme-secondary hover:text-theme-primary'
            }`}
          >
            Pipeline Health
          </button>
          <button
            onClick={() => setActiveSubTab('winloss')}
            className={`px-3 py-1.5 rounded-md cursor-pointer transition-all ${
              activeSubTab === 'winloss' ? 'bg-theme-card text-theme-primary shadow-xs border border-theme-border/50' : 'text-theme-secondary hover:text-theme-primary'
            }`}
          >
            Win/Loss Analysis
          </button>
          <button
            onClick={() => setActiveSubTab('builder')}
            className={`px-3 py-1.5 rounded-md cursor-pointer transition-all ${
              activeSubTab === 'builder' ? 'bg-theme-card text-theme-primary shadow-xs border border-theme-border/50' : 'text-theme-secondary hover:text-theme-primary'
            }`}
          >
            Custom Report Builder
          </button>
        </div>
      </header>

      {/* Main content scroll pane */}
      <div className="flex-1 overflow-y-auto p-6 font-sans">
        
        {/* SUB TAB: DASHBOARDS */}
        {activeSubTab === 'dash' && (
          <div className="space-y-6">
            
            {/* Top Scorecard Widgets Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
              <div className="bg-theme-card p-5 rounded-xl shadow-xs border border-theme-border">
                <div className="flex justify-between items-start">
                  <span className="text-xs font-semibold text-theme-secondary uppercase font-sans">Open Pipeline Value</span>
                  <div className="p-1 bg-theme-accent/10 text-theme-accent rounded">
                    <DollarSign className="w-4 h-4" />
                  </div>
                </div>
                <h3 className="text-2xl font-bold text-theme-primary mt-2">
                  ${totalOpenValue.toLocaleString()}
                </h3>
                <p className="text-[10px] text-theme-secondary mt-2 font-medium">Across {openDeals.length} active opportunities</p>
              </div>

              <div className="bg-theme-card p-5 rounded-xl shadow-xs border border-theme-border">
                <div className="flex justify-between items-start">
                  <span className="text-xs font-semibold text-theme-secondary uppercase font-sans">Closed Won Revenue</span>
                  <div className="p-1 bg-theme-accent/10 text-theme-accent rounded">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                </div>
                <h3 className="text-2xl font-bold text-theme-primary mt-2">
                  ${totalWonValue.toLocaleString()}
                </h3>
                <p className="text-[10px] text-theme-accent mt-2 font-medium flex items-center gap-0.5">
                  Quota target: ${personalQuota.toLocaleString()}
                </p>
              </div>

              <div className="bg-theme-card p-5 rounded-xl shadow-xs border border-theme-border">
                <div className="flex justify-between items-start">
                  <span className="text-xs font-semibold text-theme-secondary uppercase font-sans">Opportunity Win Rate</span>
                  <div className="p-1 bg-theme-accent/10 text-theme-accent rounded">
                    <Percent className="w-4 h-4" />
                  </div>
                </div>
                <h3 className="text-2xl font-bold text-theme-primary mt-2">
                  {winRate.toFixed(1)}%
                </h3>
                <p className="text-[10px] text-theme-secondary mt-2 font-medium">{wonDeals.length} Won / {lostDeals.length} Lost</p>
              </div>

              <div className="bg-theme-card p-5 rounded-xl shadow-xs border border-theme-border">
                <div className="flex justify-between items-start">
                  <span className="text-xs font-semibold text-theme-secondary uppercase font-sans">Activities Logged</span>
                  <div className="p-1 bg-theme-accent/10 text-theme-accent rounded">
                    <ListTodo className="w-4 h-4" />
                  </div>
                </div>
                <h3 className="text-2xl font-bold text-theme-primary mt-2">
                  {scopedActivities.length}
                </h3>
                <p className="text-[10px] text-theme-secondary mt-2 font-medium">Calls, notes, emails synced</p>
              </div>
            </div>

            {/* Dashboard Visual Charts & Quota attainments */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Box 1: Custom Quota Gauge (SVG) */}
              <div className="bg-theme-card p-5 rounded-xl shadow-xs border border-theme-border flex flex-col justify-between">
                <div>
                  <h4 className="text-xs font-bold uppercase font-sans tracking-wider text-theme-secondary">Q3 Quota Attainment</h4>
                  <p className="text-[11px] text-theme-secondary mt-0.5">Closed won target achievement</p>
                </div>

                <div className="flex flex-col items-center justify-center my-6 relative">
                  {/* Custom SVG semicircle gauge */}
                  <svg className="w-48 h-28">
                    {/* Background track */}
                    <path
                      d="M 10 100 A 80 80 0 0 1 170 100"
                      fill="none"
                      stroke="var(--border)"
                      strokeWidth="16"
                      strokeLinecap="round"
                    />
                    {/* Foreground fill based on score */}
                    <path
                      d="M 10 100 A 80 80 0 0 1 170 100"
                      fill="none"
                      stroke="var(--accent)"
                      strokeWidth="16"
                      strokeLinecap="round"
                      strokeDasharray="251"
                      strokeDashoffset={Math.max(0, 251 - (251 * Math.min(100, repQuotaAttainment)) / 100)}
                      className="transition-all duration-1000 ease-out"
                    />
                  </svg>
                  <div className="text-center absolute bottom-0">
                    <span className="text-3xl font-extrabold text-theme-primary">{Math.round(repQuotaAttainment)}%</span>
                    <span className="block text-[10px] uppercase font-sans tracking-wider font-semibold text-theme-secondary mt-1">
                      ${totalWonValue.toLocaleString()} / $1M
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-theme-base/50 rounded-lg border border-theme-border text-[11px] text-theme-secondary leading-normal font-medium">
                  {repQuotaAttainment >= 100 
                    ? "🎉 Outstanding! You have fully attained and exceeded your seasonal revenue quota."
                    : `Keep pushing! You need another $${(personalQuota - totalWonValue).toLocaleString()} in Closed Won revenue to hit Q3 attainment.`}
                </div>
              </div>

              {/* Box 2: ScScoped pipeline distribution bar chart (SVG) */}
              <div className="bg-theme-card p-5 rounded-xl shadow-xs border border-theme-border lg:col-span-2">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h4 className="text-xs font-bold uppercase font-sans tracking-wider text-theme-secondary">Pipeline Stage Distribution</h4>
                    <p className="text-[11px] text-theme-secondary mt-0.5">Total pipeline value grouped by stage</p>
                  </div>
                  <BarChart3 className="w-4 h-4 text-theme-secondary" />
                </div>

                <div className="space-y-3.5 my-4">
                  {stages.filter(s => s.pipeline_id === 'pipe-enterprise').map(stg => {
                    const stgDeals = scopedDeals.filter(d => d.stage_id === stg.id);
                    const totalVal = stgDeals.reduce((sum, d) => sum + d.value, 0);
                    const maxVal = Math.max(...stages.filter(s => s.pipeline_id === 'pipe-enterprise').map(s => 
                      scopedDeals.filter(d => d.stage_id === s.id).reduce((sum, d) => sum + d.value, 0)
                    )) || 1;
                    const percent = (totalVal / maxVal) * 100;

                    return (
                      <div key={stg.id} className="space-y-1">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-semibold text-theme-secondary">{stg.name} <span className="text-[10px] text-theme-secondary/70 font-sans">({stgDeals.length} deals)</span></span>
                          <span className="font-bold text-theme-primary">${totalVal.toLocaleString()}</span>
                        </div>
                        <div className="w-full bg-theme-base rounded-full h-3 overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-1000 ${
                              stg.type === 'won' ? 'bg-theme-accent' : stg.type === 'lost' ? 'bg-theme-secondary/30' : 'bg-theme-accent/80'
                            }`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* If Manager role, display side-by-side leaderboard */}
            {isManagerOrAdmin && (
              <div className="bg-theme-card p-5 rounded-xl shadow-xs border border-theme-border">
                <h4 className="text-xs font-bold uppercase font-sans tracking-wider text-theme-secondary mb-4">Team Performance Leaderboard</h4>
                
                {users.length === 0 ? (
                  <div className="text-center py-6 text-xs text-theme-secondary font-sans">
                    No active team members found.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    {users.map(u => {
                      const userDeals = scopedDeals.filter(d => d.owner_id === u.id);
                      const userWonRevenue = userDeals
                        .filter(d => stages.find(s => s.id === d.stage_id)?.type === 'won')
                        .reduce((sum, d) => sum + d.value, 0);
                      const userOpenValue = userDeals
                        .filter(d => stages.find(s => s.id === d.stage_id)?.type === 'open')
                        .reduce((sum, d) => sum + d.value, 0);
                      const userActivities = scopedActivities.filter(act => act.user_id === u.id);
                      
                      const initials = u.name
                        .split(' ')
                        .map(n => n[0])
                        .join('')
                        .toUpperCase()
                        .slice(0, 2);

                      return (
                        <div key={u.id} className="p-4 bg-theme-base/30 rounded-lg border border-theme-border">
                          <div className="flex items-center gap-2 mb-3">
                            <div className="w-8 h-8 rounded-full border border-theme-border bg-theme-accent/10 flex items-center justify-center text-theme-accent text-xs font-bold shrink-0">
                              {initials || '?'}
                            </div>
                            <div>
                              <h5 className="text-xs font-bold text-theme-primary">{u.name}</h5>
                              <p className="text-[10px] text-theme-secondary uppercase font-sans">
                                {u.role === UserRole.SUPER_ADMIN ? 'Super Admin' :
                                 u.role === UserRole.ADMIN ? 'Administrator' :
                                 u.role === UserRole.MANAGER ? 'Team Manager' :
                                 u.role === UserRole.SALES_REP ? 'Sales Representative' : 'Viewer'}
                              </p>
                            </div>
                          </div>
                          <div className="space-y-2 text-xs">
                            <div className="flex justify-between">
                              <span className="text-theme-secondary">Won Revenue</span>
                              <span className="font-bold text-theme-primary">${userWonRevenue.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-theme-secondary">Open Opportunities</span>
                              <span className="font-bold text-theme-primary">${userOpenValue.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-theme-secondary">Activities Logged</span>
                              <span className="font-semibold text-theme-secondary">{userActivities.length} logs</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* SUB TAB: PIPELINE HEALTH */}
        {activeSubTab === 'health' && (
          <div className="bg-theme-card p-6 rounded-xl shadow-xs border border-theme-border space-y-6">
            <div>
              <h3 className="text-base font-bold text-theme-primary flex items-center gap-1.5">
                <GitPullRequest className="w-5 h-5 text-theme-accent" />
                Pipeline Conversion Funnel & Health Diagnostics
              </h3>
              <p className="text-xs text-theme-secondary mt-1">
                Visualizing conversion degradation at each pipeline stage. Ideal for identifying sales friction bottlenecks.
              </p>
            </div>

            {/* Custom Funnel Visualizer (SVG Horizontal bars of decreasing width) */}
            <div className="flex flex-col items-center justify-center py-6 space-y-4 max-w-xl mx-auto">
              {stages.filter(s => s.pipeline_id === 'pipe-enterprise' && s.type === 'open').map((stg, index) => {
                const dealsInStgCount = scopedDeals.filter(d => d.stage_id === stg.id).length;
                const widthPercent = 100 - (index * 15); // Stagger funnel layout
                
                return (
                  <div key={stg.id} className="w-full flex items-center gap-4">
                    <span className="w-32 text-right text-xs font-semibold text-theme-secondary">{stg.name}</span>
                    <div className="flex-1">
                      <div 
                        className="bg-theme-accent hover:opacity-90 text-white text-xs font-bold py-2 px-3 rounded shadow-xs flex justify-between items-center transition-all"
                        style={{ width: `${widthPercent}%` }}
                      >
                        <span>{dealsInStgCount} Deals</span>
                        <span>{stg.probability}% Prob</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-theme-border pt-5">
              <h4 className="text-xs font-bold uppercase font-sans tracking-wider text-theme-secondary mb-3">Health Indicators</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-theme-secondary leading-normal">
                <div className="p-4 bg-theme-accent/5 rounded-lg border border-theme-accent/15 flex gap-3">
                  <div className="text-theme-accent shrink-0 text-base">⚠️</div>
                  <div>
                    <span className="font-semibold block text-theme-primary">Proposal Bottleneck Detected</span>
                    Solutions Demo stage has 1 deal stagnant for over 14 days. Close attention is recommended on "Globex Next-Gen Turbine Licensing" to avoid deal stall.
                  </div>
                </div>
                <div className="p-4 bg-theme-accent/10 rounded-lg border border-theme-accent/20 flex gap-3">
                  <div className="text-theme-accent shrink-0 text-base">✅</div>
                  <div>
                    <span className="font-semibold block text-theme-primary">Positive Velocity</span>
                    Contract negotiation stage has transitioned 2 deals successfully into Won states within the last 30 days. No deal loss registered during negotiations.
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SUB TAB: WIN/LOSS ANALYSIS */}
        {activeSubTab === 'winloss' && (
          <div className="bg-theme-card p-6 rounded-xl shadow-xs border border-theme-border space-y-6">
            <div>
              <h3 className="text-base font-bold text-theme-primary flex items-center gap-1.5">
                <PieChart className="w-5 h-5 text-theme-accent" />
                Win / Loss Analysis & Competitor Intel
              </h3>
              <p className="text-xs text-theme-secondary mt-1">
                Deconstructing deal metrics by outcomes, competitors, and underlying reasons.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Lost Reason Breakdown */}
              <div className="p-4 bg-theme-base/30 rounded-lg border border-theme-border">
                <h4 className="text-xs font-bold uppercase font-sans tracking-wider text-theme-secondary mb-3">Lost Reason Attribution</h4>
                
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-xs text-theme-secondary font-semibold mb-1">
                      <span>Competitor Price Undercutting</span>
                      <span>50%</span>
                    </div>
                    <div className="w-full bg-theme-base h-2 rounded-full overflow-hidden">
                      <div className="bg-theme-accent/70 h-full rounded-full" style={{ width: '50%' }} />
                    </div>
                  </div>
                  
                  <div>
                    <div className="flex justify-between text-xs text-theme-secondary font-semibold mb-1">
                      <span>Feature Deficit</span>
                      <span>30%</span>
                    </div>
                    <div className="w-full bg-theme-base h-2 rounded-full overflow-hidden">
                      <div className="bg-theme-accent/45 h-full rounded-full" style={{ width: '30%' }} />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs text-theme-secondary font-semibold mb-1">
                      <span>Executive Sponsor Churn</span>
                      <span>20%</span>
                    </div>
                    <div className="w-full bg-theme-base h-2 rounded-full overflow-hidden">
                      <div className="bg-theme-secondary/40 h-full rounded-full" style={{ width: '20%' }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Competitor Standings */}
              <div className="p-4 bg-theme-base/30 rounded-lg border border-theme-border flex flex-col justify-between">
                <div>
                  <h4 className="text-xs font-bold uppercase font-sans tracking-wider text-theme-secondary mb-3">Key Competitor Head-to-Head</h4>
                  <p className="text-[11px] text-theme-secondary/80">Winning rates where competitors are logged</p>
                </div>

                <div className="space-y-2 mt-3 text-xs">
                  {(() => {
                    // Extract competitors dynamically from deal custom fields
                    const competitorStats: Record<string, { won: number; closed: number }> = {};
                    
                    scopedDeals.forEach(d => {
                      const compName = d.custom_fields?.competitor_name;
                      if (!compName || typeof compName !== 'string') return;
                      
                      const normalizedName = compName.trim();
                      if (!normalizedName) return;
                      
                      const stage = stages.find(s => s.id === d.stage_id);
                      if (!stage) return;
                      
                      if (!competitorStats[normalizedName]) {
                        competitorStats[normalizedName] = { won: 0, closed: 0 };
                      }
                      
                      if (stage.type === 'won') {
                        competitorStats[normalizedName].won += 1;
                        competitorStats[normalizedName].closed += 1;
                      } else if (stage.type === 'lost') {
                        competitorStats[normalizedName].closed += 1;
                      }
                    });

                    const statsArray = Object.entries(competitorStats);

                    if (statsArray.length === 0) {
                      return (
                        <div className="text-center py-6 text-[11px] text-theme-secondary">
                          No competitor interactions logged in active opportunities.
                        </div>
                      );
                    }

                    return statsArray.map(([name, stats]) => {
                      const winRate = stats.closed > 0 ? (stats.won / stats.closed) * 100 : 0;
                      return (
                        <div key={name} className="p-2 bg-theme-card rounded border border-theme-border flex justify-between items-center">
                          <span className="font-semibold text-theme-primary">{name}</span>
                          <span className="bg-theme-accent/10 text-theme-primary px-1.5 py-0.5 rounded text-[10px] font-bold font-sans">
                            {winRate.toFixed(0)}% Win Rate ({stats.closed} closed)
                          </span>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SUB TAB: CUSTOM REPORT BUILDER */}
        {activeSubTab === 'builder' && (
          <div className="space-y-6">
            <div className="bg-theme-card p-6 rounded-xl shadow-xs border border-theme-border">
              <h3 className="text-base font-bold text-theme-primary flex items-center gap-1.5">
                <Sparkles className="w-5 h-5 text-theme-accent" />
                Dynamic Custom Report Configurator
              </h3>
              <p className="text-xs text-theme-secondary mt-1">
                Construct bespoke analytical spreadsheets. Segment by users, accounts, or dates instantly.
              </p>

              {/* Builder Controls */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6 p-4 bg-theme-base/30 rounded-lg border border-theme-border">
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase font-sans text-theme-secondary">Query Entity</label>
                  <select 
                    value={reportEntity} 
                    onChange={(e) => setReportEntity(e.target.value as any)}
                    className="w-full bg-theme-card text-theme-primary rounded border border-theme-border px-2.5 py-2 text-xs focus:ring-1 focus:ring-theme-accent focus:outline-none"
                  >
                    <option value="deal">Sales Opportunities (Deals)</option>
                    <option value="contact">Business Contacts</option>
                    <option value="task">Tasks & Due Dates</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase font-sans text-theme-secondary">Grouping Column</label>
                  <select 
                    value={reportGrouping} 
                    onChange={(e) => setReportGrouping(e.target.value)}
                    className="w-full bg-theme-card text-theme-primary rounded border border-theme-border px-2.5 py-2 text-xs focus:ring-1 focus:ring-theme-accent focus:outline-none"
                  >
                    <option value="owner_id">Assigned Owner (Sales Rep)</option>
                    {reportEntity === 'deal' && <option value="stage_id">Opportunity Stage</option>}
                    {(reportEntity === 'deal' || reportEntity === 'contact') && <option value="account_id">Account (Company)</option>}
                    {reportEntity === 'task' && <option value="type">Task Type</option>}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase font-sans text-theme-secondary">Aggregated Metric</label>
                  <select 
                    value={reportMetric} 
                    onChange={(e) => setReportMetric(e.target.value as any)}
                    className="w-full bg-theme-card text-theme-primary rounded border border-theme-border px-2.5 py-2 text-xs focus:ring-1 focus:ring-theme-accent focus:outline-none"
                  >
                    <option value="count">Count (Total Records)</option>
                    {reportEntity === 'deal' && <option value="sum_value">Sum of Monetary Value ($)</option>}
                  </select>
                </div>

                <div className="flex items-end">
                  <button
                    onClick={handleGenerateReport}
                    className="w-full bg-theme-accent hover:opacity-90 text-white font-semibold py-2 px-4 rounded text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Compile Report
                  </button>
                </div>
              </div>
            </div>

            {/* Generated Report Display */}
            {reportGenerated && (
              <div className="bg-theme-card p-5 rounded-xl shadow-xs border border-theme-border space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-bold uppercase font-sans tracking-wider text-theme-secondary">Report Output</h4>
                  <button className="text-xs text-theme-accent hover:opacity-80 font-medium flex items-center gap-1 cursor-pointer">
                    <FileDown className="w-3.5 h-3.5" /> Export as CSV
                  </button>
                </div>

                <div className="overflow-x-auto rounded-lg border border-theme-border">
                  <table className="w-full text-left text-xs divide-y divide-theme-border">
                    <thead className="bg-theme-base font-bold text-theme-secondary uppercase font-sans text-[10px]">
                      <tr>
                        <th className="px-4 py-3">Group Matrix</th>
                        <th className="px-4 py-3 text-right">Volume</th>
                        {reportEntity === 'deal' && reportMetric === 'sum_value' && <th className="px-4 py-3 text-right">Total Financial Value</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-theme-border text-theme-secondary">
                      {reportResult.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="px-4 py-6 text-center text-theme-secondary/70">No matching record aggregates</td>
                        </tr>
                      ) : (
                        reportResult.map((row, idx) => (
                          <tr key={idx} className="hover:bg-theme-base/30">
                            <td className="px-4 py-3 font-semibold text-theme-primary">{row.groupName}</td>
                            <td className="px-4 py-3 text-right font-sans">{row.count}</td>
                            {reportEntity === 'deal' && reportMetric === 'sum_value' && (
                              <td className="px-4 py-3 text-right font-sans font-bold text-theme-primary">${row.value.toLocaleString()}</td>
                            )}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
