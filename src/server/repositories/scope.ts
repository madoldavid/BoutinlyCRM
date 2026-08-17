import { UserRole } from '../../types.js';
import type { CrmSnapshot } from './crmRepository.js';
import type { Principal } from '../security/token.js';

export function scopeSnapshot(snapshot: CrmSnapshot, principal: Principal): CrmSnapshot {
  // ── Defense-in-depth: filter by organization first ──
  // Include records where organization_id is undefined (backward compat)
  // or matches the principal's organization.
  const byOrg = <T extends { organization_id?: string }>(items: T[]): T[] =>
    items.filter(item => !item.organization_id || item.organization_id === principal.organizationId);

  const orgScoped: CrmSnapshot = {
    users: byOrg(snapshot.users),
    accounts: byOrg(snapshot.accounts),
    contacts: byOrg(snapshot.contacts),
<<<<<<< HEAD
    pipelines: byOrg(snapshot.pipelines),
    stages: byOrg(snapshot.stages),
=======
    leads: byOrg(snapshot.leads),
    pipelines: snapshot.pipelines,
    stages: snapshot.stages,
>>>>>>> 41b4c3ae4ad66e243403374fe02d576454752884
    deals: byOrg(snapshot.deals),
    tasks: byOrg(snapshot.tasks),
    activities: byOrg(snapshot.activities),
    recordTasks: byOrg(snapshot.recordTasks ?? []),
    callLogs: byOrg(snapshot.callLogs ?? []),
    notifications: byOrg(snapshot.notifications),
    customFields: byOrg(snapshot.customFields),
    emailTemplates: byOrg(snapshot.emailTemplates),
    emailCampaigns: byOrg(snapshot.emailCampaigns),
    auditLogs: byOrg(snapshot.auditLogs),
  };

  // ── RBAC scoping ─────────────────────────────────────
  if ([UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.VIEWER].includes(principal.role)) {
    return orgScoped;
  }

  const visibleUserIds = new Set(
    principal.role === UserRole.MANAGER && principal.teamId
      ? orgScoped.users.filter(user => user.team_id === principal.teamId).map(user => user.id)
      : [principal.userId],
  );

  const accounts = orgScoped.accounts.filter(account => visibleUserIds.has(account.owner_id));
  const accountIds = new Set(accounts.map(account => account.id));
  const leads = orgScoped.leads.filter(lead => visibleUserIds.has(lead.owner_id));
  const leadIds = new Set(leads.map(lead => lead.id));
  const contacts = orgScoped.contacts.filter(contact => visibleUserIds.has(contact.owner_id) || accountIds.has(contact.account_id));
  const contactIds = new Set(contacts.map(contact => contact.id));
  const deals = orgScoped.deals.filter(deal => visibleUserIds.has(deal.owner_id) || accountIds.has(deal.account_id));
  const dealIds = new Set(deals.map(deal => deal.id));

  const timelineVisible = (item: { user_id: string; associated_to_id: string }) =>
    visibleUserIds.has(item.user_id) ||
    leadIds.has(item.associated_to_id) ||
    contactIds.has(item.associated_to_id) ||
    dealIds.has(item.associated_to_id);

  return {
    ...orgScoped,
    users: orgScoped.users.filter(user => visibleUserIds.has(user.id)),
    accounts,
    leads,
    contacts,
    deals,
    tasks: orgScoped.tasks.filter(task => visibleUserIds.has(task.assigned_to_id)),
    activities: orgScoped.activities.filter(activity => {
      return visibleUserIds.has(activity.user_id) ||
        Boolean(activity.contact_id && contactIds.has(activity.contact_id)) ||
        Boolean(activity.deal_id && dealIds.has(activity.deal_id));
    }),
    recordTasks: orgScoped.recordTasks.filter(timelineVisible),
    callLogs: orgScoped.callLogs.filter(timelineVisible),
    notifications: orgScoped.notifications.filter(notification => notification.user_id === principal.userId),
  };
}
