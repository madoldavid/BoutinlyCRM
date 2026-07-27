# Boutinly CRM — Complete Use Case Diagram

```mermaid
graph TB
    %% ── STYLING ──
    classDef actor fill:#1e293b,stroke:#64748b,color:#e2e8f0,stroke-width:2px
    classDef system fill:#0f172a,stroke:#38bdf8,color:#e2e8f0,stroke-width:3px
    classDef boundary fill:#0c4a6e,stroke:#0284c7,color:#e0f2fe,stroke-width:2px
    classDef extActor fill:#3b0764,stroke:#a855f7,color:#e0e7ff,stroke-width:2px

    %% ═══════════════════════════════════════════
    %% ACTORS
    %% ═══════════════════════════════════════════
    SA["🛡️ Super Admin"]:::actor
    AD["🔧 Admin"]:::actor
    MG["📊 Manager"]:::actor
    SR["📞 Sales Rep"]:::actor
    VW["👁️ Viewer"]:::actor
    ES["📨 Email Service\n(SMTP / AWS SES)"]:::extActor
    GC["📅 Google Calendar\n(External OAuth)"]:::extActor
    OC["📅 Outlook/M365\n(External OAuth)"]:::extActor

    %% ═══════════════════════════════════════════
    %% CRM SYSTEM BOUNDARY
    %% ═══════════════════════════════════════════
    subgraph CRM["🏢 Boutinly CRM System"]
        direction TB
        style CRM stroke:#38bdf8,stroke-width:4px,fill:#020617

        %% ── AUTHENTICATION ──
        subgraph AUTH["🔐 Authentication & Identity"]
            direction TB
            A1["Sign Up\n(First User Only)"]:::boundary
            A2["Login with Email & Password"]:::boundary
            A3["MFA Challenge\n(TOTP Code Verification)"]:::boundary
            A4["Enable MFA\n(Scan QR + Verify)"]:::boundary
            A5["Disable MFA\n(Re-verify Password)"]:::boundary
            A6["Forgot Password\n(Request Reset Email)"]:::boundary
            A7["Reset Password\n(Consume Token)"]:::boundary
            A8["Refresh Access Token"]:::boundary
            A9["View Current User Profile"]:::boundary
        end

        %% ── CONTACTS ──
        subgraph CON["👥 Contact Management"]
            direction TB
            C1["List Contacts\n(Search, Paginate, Tag Filter)"]:::boundary
            C2["Create Contact\n(With Custom Fields)"]:::boundary
            C3["Edit Contact"]:::boundary
            C4["Delete Contact"]:::boundary
            C5["Merge Duplicate Contacts"]:::boundary
            C6["Bulk Import Contacts\n(CSV Upload)"]:::boundary
            C7["View Contact Timeline\n(Linked Activities)"]:::boundary
            C8["Add Note to Contact Timeline"]:::boundary
        end

        %% ── ACCOUNTS ──
        subgraph ACC["🏢 Account Management"]
            direction TB
            AC1["List Accounts\n(Search, Paginate, Tag Filter)"]:::boundary
            AC2["Create Account\n(With Custom Fields)"]:::boundary
            AC3["Edit Account"]:::boundary
            AC4["Delete Account"]:::boundary
            AC5["View Account Timeline\n(Linked Contacts & Activities)"]:::boundary
        end

        %% ── DEALS / PIPELINE ──
        subgraph DEAL["💰 Sales Pipeline & Deals"]
            direction TB
            D1["View Pipeline Kanban Board\n(Drag to Move Deals)"]:::boundary
            D2["View Deals List\n(Sortable, Filterable Table)"]:::boundary
            D3["View Forecast\n(Revenue Projections)"]:::boundary
            D4["Create Deal\n(With Line Items)"]:::boundary
            D5["Edit Deal"]:::boundary
            D6["Delete Deal"]:::boundary
            D7["Move Deal to Stage\n(Creates Stage-Change Activity)"]:::boundary
            D8["Close Deal\n(Won / Lost with Reason)"]:::boundary
        end

        %% ── TASKS ──
        subgraph TSK["✅ Task Management"]
            direction TB
            T1["List Tasks\n(Active, Overdue, Completed, All)"]:::boundary
            T2["View Calendar\n(Monthly Task Grid)"]:::boundary
            T3["Create Task\n(With Recurrence Rules)"]:::boundary
            T4["Edit Task"]:::boundary
            T5["Complete Task\n(With Optional Note)"]:::boundary
            T6["Delete Task"]:::boundary
            T7["Log Outbound Call\n(Contact, Duration, Outcome)"]:::boundary
            T8["Sync Google Calendar"]:::boundary
            T9["Sync Outlook/M365 Calendar"]:::boundary
        end

        %% ── ACTIVITIES ──
        subgraph ACT["📝 Activity Logging"]
            direction TB
            ACT1["List Activities\n(Filter by Contact/Deal/User)"]:::boundary
            ACT2["Create Activity Entry\n(Call, Meeting, Note, etc.)"]:::boundary
        end

        %% ── EMAIL ──
        subgraph EML["📨 Email & Campaigns"]
            direction TB
            E1["Compose & Send Email\n(With Templates & Variables)"]:::boundary
            E2["Manage Email Templates\n(CRUD, Categorize)"]:::boundary
            E3["Create & Send Bulk Campaign\n(Per-Recipient Tracking)"]:::boundary
            E4["View Campaign Metrics\n(Open Rate, Click Rate, Bounces)"]:::boundary
        end

        %% ── REPORTS ──
        subgraph RPT["📊 Reports & Analytics"]
            direction TB
            R1["View Team Dashboard\n(Pipeline Value, Revenue, Win Rate)"]:::boundary
            R2["View My Dashboard\n(Personal Rep Metrics)"]:::boundary
            R3["View Pipeline Health\n(Conversion Funnel, Stagnant Deals)"]:::boundary
            R4["View Win/Loss Analysis\n(Lost Reason Attribution, Competitor Table)"]:::boundary
            R5["Build Custom Report\n(Entity, Group By, Aggregate, CSV Export)"]:::boundary
            R6["View Team Leaderboard\n(Per-Rep Performance)"]:::boundary
        end

        %% ── ADMIN ──
        subgraph ADM["⚙️ System Administration"]
            direction TB
            ADM1["List Users"]:::boundary
            ADM2["Invite User\n(Set Name, Email, Role)"]:::boundary
            ADM3["Change User Role"]:::boundary
            ADM4["Activate / Deactivate User"]:::boundary
            ADM5["Manage Custom Fields\n(Per-Entity Definitions)"]:::boundary
            ADM6["View Audit Trail\n(Search, Filter, Inspect Diffs)"]:::boundary
            ADM7["Configure AWS SES Domain\n(SPF/DKIM Verification)"]:::boundary
        end

        %% ── NOTIFICATIONS ──
        subgraph NOT["🔔 Notifications"]
            direction TB
            N1["View Notifications\n(Dropdown Panel)"]:::boundary
            N2["Mark Notification as Read"]:::boundary
            N3["Mark All Notifications Read"]:::boundary
        end

        %% ── GDPR ──
        subgraph GDPR["🔒 Data Privacy (GDPR)"]
            direction TB
            G1["Export Personal Data\n(Art. 20 Portability)"]:::boundary
            G2["Delete Account & Data\n(Art. 17 Erasure, Requires Password)"]:::boundary
        end
    end

    %% ═══════════════════════════════════════════
    %% ACTOR ASSIGNMENTS
    %% ═══════════════════════════════════════════

    %% ── All roles ──
    SA --> A1
    SA --> A2
    SA --> A3
    SA --> A4
    SA --> A5
    SA --> A6
    SA --> A7
    SA --> A8
    SA --> A9

    AD --> A2 & A3 & A4 & A5 & A6 & A7 & A8 & A9
    MG --> A2 & A3 & A4 & A5 & A6 & A7 & A8 & A9
    SR --> A2 & A3 & A4 & A5 & A6 & A7 & A8 & A9
    VW --> A2 & A3 & A4 & A5 & A6 & A7 & A8 & A9

    %% Contacts — all roles (VW read-only)
    SA & AD & MG & SR --> C1 & C2 & C3 & C4 & C5 & C6 & C7 & C8
    VW --> C1 & C7

    %% Accounts — all roles (VW read-only)
    SA & AD & MG & SR --> AC1 & AC2 & AC3 & AC4 & AC5
    VW --> AC1 & AC5

    %% Deals — all roles (VW read-only)
    SA & AD & MG & SR --> D1 & D2 & D3 & D4 & D5 & D6 & D7 & D8
    VW --> D1 & D2 & D3

    %% Tasks — all roles (VW read-only)
    SA & AD & MG & SR --> T1 & T2 & T3 & T4 & T5 & T6 & T7
    VW --> T1 & T2

    %% Calendar sync — all roles
    SA & AD & MG & SR & VW --> T8 & T9

    %% Activities — all roles (VW read-only)
    SA & AD & MG & SR --> ACT1 & ACT2
    VW --> ACT1

    %% Email — all roles (VW read-only)
    SA & AD & MG & SR --> E1 & E2 & E3 & E4
    VW --> E2 & E4

    %% Reports — role-specific
    SA & AD --> R1 & R2 & R3 & R4 & R5 & R6
    MG --> R1 & R2 & R3 & R4 & R5 & R6
    SR --> R2
    VW --> R1 & R3 & R4

    %% Admin — SUPER_ADMIN and ADMIN only
    SA & AD --> ADM1 & ADM2 & ADM3 & ADM4 & ADM5 & ADM6 & ADM7

    %% Notifications — all roles
    SA & AD & MG & SR & VW --> N1 & N2 & N3

    %% GDPR — all roles
    SA & AD & MG & SR & VW --> G1 & G2

    %% ═══════════════════════════════════════════
    %% EXTERNAL SYSTEM INTERACTIONS
    %% ═══════════════════════════════════════════
    ES -- "Sends: password reset, invites, campaigns" --> E1
    ES -- "Delivers" --> E3
    GC -- "Two-way Sync" --> T8
    OC -- "Two-way Sync" --> T9

    %% ═══════════════════════════════════════════
    %% INCLUDE / EXTEND RELATIONSHIPS
    %% ═══════════════════════════════════════════
    A3 -.->|extends| A2
    A4 -.->|extends| A2
    C8 -.->|extends| C7
    D7 -.->|extends| D1
    D8 -.->|extends| D7
    T5 -.->|extends| T1
    T7 -.->|extends| ACT2
    E4 -.->|extends| E3
    R6 -.->|extends| R1
```

---

## Actor Definitions

| Actor | Description |
|-------|-------------|
| **Super Admin** | First user created at signup. Full system access — manage users, custom fields, pipelines, audit logs, and all CRM data. |
| **Admin** | Full administrative control over all customer records, custom fields, and pipelines. Can invite/manage users. |
| **Manager** | Sees records owned by team members. Aggregates team performance analytics. Has write access. |
| **Sales Rep** | Can only see and edit records they own. High-security isolation. Personal dashboard only. |
| **Viewer** | Can view all records and analytics across the organization, but cannot make any edits (read-only). |
| **Email Service** | External system (SMTP, AWS SES, or Console dev logger) that delivers transactional emails. |
| **Google Calendar** | External OAuth 2.0 integration for two-way calendar sync. |
| **Outlook/M365** | External calendar integration for Outlook/M365 users. |

---

## Use Case Catalog

### Authentication & Identity (10 use cases)
| ID | Use Case | Actors | Description |
|----|----------|--------|-------------|
| A1 | Sign Up | Super Admin | First-user self-registration. Creates org + default pipeline + 7 stages. Blocked once users exist. |
| A2 | Login | All | Email + password authentication. Returns JWT (15 min) + refresh token (7 days). |
| A3 | MFA Challenge | All | Second-factor TOTP code verification during login. |
| A4 | Enable MFA | All | Generate TOTP secret, display QR code, verify setup code. |
| A5 | Disable MFA | All | Turn off MFA after re-verifying password. |
| A6 | Forgot Password | All | Request password reset email. Always returns success (prevents enumeration). |
| A7 | Reset Password | All | Consume one-time reset token and set new password. |
| A8 | Refresh Token | All | Exchange refresh token for new access + refresh pair. |
| A9 | View Profile | All | Get current authenticated user details. |

### Contact Management (8 use cases)
| ID | Use Case | Actors | Description |
|----|----------|--------|-------------|
| C1 | List Contacts | All | Searchable, paginated contact list with tag filtering. |
| C2 | Create Contact | Write roles | New contact with custom fields, account link, owner assignment. |
| C3 | Edit Contact | Write roles | Update any contact field. Audit-logged. |
| C4 | Delete Contact | Write roles | Remove contact. Audit-logged. |
| C5 | Merge Contacts | Write roles | Combine two duplicate contacts into one. Reassigns activities. |
| C6 | Bulk Import | Write roles | CSV file upload to create multiple contacts at once. |
| C7 | View Timeline | All | Contact detail panel with linked activity history. |
| C8 | Add Note | Write roles | Inline note on contact timeline. |

### Account Management (5 use cases)
| ID | Use Case | Actors | Description |
|----|----------|--------|-------------|
| AC1 | List Accounts | All | Searchable, paginated account list with tag filtering. |
| AC2 | Create Account | Write roles | New account with domain, industry, size, ARR, owner. |
| AC3 | Edit Account | Write roles | Update account fields. Audit-logged. |
| AC4 | Delete Account | Write roles | Remove account. Audit-logged. |
| AC5 | View Timeline | All | Account detail with linked contacts and activities. |

### Sales Pipeline & Deals (8 use cases)
| ID | Use Case | Actors | Description |
|----|----------|--------|-------------|
| D1 | Kanban Board | All | Visual drag-and-drop pipeline view across stages. |
| D2 | Deals List | All | Sortable, filterable table view of all deals. |
| D3 | Forecast | All | Revenue projection based on stage probabilities. |
| D4 | Create Deal | Write roles | New deal with line items, pipeline, stage, owner, value. |
| D5 | Edit Deal | Write roles | Update deal fields. Audit-logged. |
| D6 | Delete Deal | Write roles | Remove deal. Audit-logged. |
| D7 | Move Stage | Write roles | Move deal to different pipeline stage. Creates stage-change activity. |
| D8 | Close Deal | Write roles | Close as Won or Lost with optional reason (Price, Budget, Competitor, Timing, No Decision, Other). |

### Task Management (9 use cases)
| ID | Use Case | Actors | Description |
|----|----------|--------|-------------|
| T1 | List Tasks | All | Filtered list: Active, Overdue, Completed, All Scoped. |
| T2 | Calendar View | All | Monthly calendar grid with tasks on due dates. |
| T3 | Create Task | Write roles | Task with type, priority, due date, assignee, recurrence rule. |
| T4 | Edit Task | Write roles | Update task fields. Audit-logged. |
| T5 | Complete Task | Write roles | Mark done with optional completion note. Creates activity. |
| T6 | Delete Task | Write roles | Remove task. Audit-logged. |
| T7 | Log Call | Write roles | Record outbound call with contact, duration, outcome, summary. |
| T8 | Sync Google Calendar | All | Two-way OAuth sync with Google Calendar. |
| T9 | Sync Outlook Calendar | All | Two-way sync with Outlook/M365 Calendar. |

### Activity Logging (2 use cases)
| ID | Use Case | Actors | Description |
|----|----------|--------|-------------|
| ACT1 | List Activities | All | Filter by contact, deal, or user. |
| ACT2 | Create Activity | Write roles | Log call, meeting, note, or other activity type. |

### Email & Campaigns (4 use cases)
| ID | Use Case | Actors | Description |
|----|----------|--------|-------------|
| E1 | Send Email | Write roles | Compose and send single email with template variables. |
| E2 | Manage Templates | All | CRUD for reusable HTML email templates with categories. |
| E3 | Send Campaign | Write roles | Bulk email campaign with per-recipient tracking. |
| E4 | Campaign Metrics | All | View open rate, click rate, bounce rate per campaign. |

### Reports & Analytics (6 use cases)
| ID | Use Case | Actors | Description |
|----|----------|--------|-------------|
| R1 | Team Dashboard | Admin, Manager, Viewer | Pipeline value, closed revenue, win rate, activity count, quota gauge. |
| R2 | My Dashboard | Sales Rep, Manager | Personal performance metrics. |
| R3 | Pipeline Health | Admin, Manager, Viewer | Conversion funnel, stagnant deal detection, velocity metrics. |
| R4 | Win/Loss Analysis | Admin, Manager, Viewer | Lost reason attribution, competitor head-to-head table. |
| R5 | Custom Report | Admin, Manager | Query builder: entity, group by, aggregate, CSV export. |
| R6 | Team Leaderboard | Admin, Manager | Per-rep: won revenue, open opportunities, activities logged. |

### System Administration (7 use cases)
| ID | Use Case | Actors | Description |
|----|----------|--------|-------------|
| ADM1 | List Users | Super Admin, Admin | View all users in the organization. |
| ADM2 | Invite User | Super Admin, Admin | Invite new user with name, email, and role. |
| ADM3 | Change Role | Super Admin, Admin | Change a user's role. Cannot change own role. |
| ADM4 | Toggle Status | Super Admin, Admin | Activate or deactivate a user. Cannot toggle own status. |
| ADM5 | Custom Fields | Super Admin, Admin | Create/delete custom field definitions per entity type. |
| ADM6 | Audit Trail | Super Admin, Admin | Search and inspect all audit log entries with JSON diffs. |
| ADM7 | SES Setup | Super Admin, Admin | Configure and verify AWS SES domain with SPF/DKIM DNS records. |

### Notifications (3 use cases)
| ID | Use Case | Actors | Description |
|----|----------|--------|-------------|
| N1 | View Notifications | All | Dropdown panel showing unread notifications with badge count. |
| N2 | Mark Read | All | Mark a single notification as read. |
| N3 | Mark All Read | All | Mark all notifications as read at once. |

### Data Privacy — GDPR (2 use cases)
| ID | Use Case | Actors | Description |
|----|----------|--------|-------------|
| G1 | Export Data | All | Export all personal data (GDPR Art. 20 — Data Portability). |
| G2 | Delete Account | All | Delete account and anonymize personal data (GDPR Art. 17). Requires password. |

---

## Permission Matrix

| Use Case Area | Super Admin | Admin | Manager | Sales Rep | Viewer |
|---------------|:-----------:|:-----:|:-------:|:---------:|:------:|
| Authentication | Full | Full | Full | Full | Full |
| Contacts | CRUD + Merge + Import | CRUD + Merge + Import | CRUD + Merge + Import | CRUD + Merge + Import | Read + Timeline |
| Accounts | CRUD | CRUD | CRUD | CRUD | Read + Timeline |
| Deals | CRUD + Move + Close | CRUD + Move + Close | CRUD + Move + Close | CRUD + Move + Close | Read |
| Tasks | CRUD + Complete + Call Log | CRUD + Complete + Call Log | CRUD + Complete + Call Log | CRUD + Complete + Call Log | Read |
| Calendar Sync | Yes | Yes | Yes | Yes | Yes |
| Activities | Create + Read | Create + Read | Create + Read | Create + Read | Read |
| Email Send | Yes | Yes | Yes | Yes | No |
| Templates/Campaigns | Read | Read | Read | Read | Read |
| Team Dashboard | Yes | Yes | Yes | No | Yes |
| My Dashboard | Yes | Yes | Yes | Yes | No |
| Pipeline Health | Yes | Yes | Yes | No | Yes |
| Win/Loss Analysis | Yes | Yes | Yes | No | Yes |
| Custom Reports | Yes | Yes | Yes | No | No |
| Team Leaderboard | Yes | Yes | Yes | No | No |
| User Management | Yes | Yes | No | No | No |
| Custom Fields | Yes | Yes | No | No | No |
| Audit Trail | Yes | Yes | No | No | No |
| SES Configuration | Yes | Yes | No | No | No |
| Notifications | Full | Full | Full | Full | Full |
| GDPR Export/Delete | Yes | Yes | Yes | Yes | Yes |

---

## RBAC Data Scoping

| Role | Sees |
|------|------|
| **Super Admin** | All data in the organization |
| **Admin** | All data in the organization |
| **Manager** | Only records owned by team members (same `team_id`) |
| **Sales Rep** | Only records they personally own (`owner_id` or `assigned_to_id`) |
| **Viewer** | All data in the organization (read-only) |

---

## Audit Trail Events (27 events)

Every write operation generates an audit log entry:

`organization.created` · `user.signup` · `login_failed` · `user.invited` · `user.role_changed` · `user.reactivated` · `user.deactivated` · `contact.created` · `contact.updated` · `contact.deleted` · `contact.merged` · `account.created` · `account.updated` · `account.deleted` · `deal.created` · `deal.updated` · `deal.deleted` · `deal.stage_changed` · `deal.won` · `deal.lost` · `task.created` · `task.updated` · `task.completed` · `task.deleted` · `activity.created` · `email_template.created` · `email.sent_single` · `campaign.sent` · `custom_field.created` · `custom_field.deleted`

---

## System Boundaries Summary

| Boundary | Contents |
|----------|----------|
| **Auth & Identity** | Signup, login, MFA setup/challenge/disable, forgot/reset password, token refresh |
| **Contact Management** | Full CRUD, merge, bulk CSV import, timeline, notes |
| **Account Management** | Full CRUD, timeline view |
| **Sales Pipeline** | Kanban board, list view, forecast, deal CRUD, stage movement, deal closing |
| **Task Management** | Task CRUD, completion, calendar view, call logging, Google/Outlook calendar sync |
| **Activity Logging** | Activity listing and creation (7 activity types) |
| **Email & Campaigns** | Single email compose, template library, bulk campaigns, campaign metrics |
| **Reports & Analytics** | Team/my dashboard, pipeline health, win/loss analysis, custom report builder, leaderboard |
| **Admin** | User management, custom fields, audit trail, SES domain setup |
| **Notifications** | In-app notification panel with read/read-all |
| **GDPR** | Data export (portability) and account deletion (erasure) |
