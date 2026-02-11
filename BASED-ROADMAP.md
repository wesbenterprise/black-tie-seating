# BASed — Barnett Automated Services Department
## Full Implementation Roadmap

**Project**: Agent Command Center for Barnett Family Partners
**Repo**: https://github.com/wesbenterprise/Barnett-Automated-Services
**Stack**: Next.js (Vercel) → FastAPI (Railway) → PostgreSQL (Supabase)
**Agent Model**: Claude Sonnet (via Anthropic API with web search)

---

## Current State (Completed)

### Phase 1: Foundation ✅
- Monorepo scaffolded (frontend/ + backend/)
- Supabase PostgreSQL with 5 tables: entities, tasks, activity_log, proposals, chat_messages
- 13 entities seeded with corrected definitions
- 24 standing orders across all frequencies
- Full CRUD API for all tables
- Railway backend deployed with pg8000 driver
- Vercel frontend deployed
- CORS configured between Vercel ↔ Railway

### Phase 2a: Agent Core (Partial) ✅
- Claude API integration with web search tool
- Chat endpoint wired to real agent (entity knowledge base injected as context)
- On-demand task execution via ▶ RUN button
- Structured logging (Goal/Strategy/Results/Learnings/Flag)
- Activity log populated from task runs
- API cost tracking per execution

---

## Phase 2b: Agent Core (Remaining)

### 2b-1: Fix Web Search Tool Use Handling

The current `_call_with_search` method in `backend/services/agent.py` handles the server-side web search tool, but the continuation loop needs hardening. The Anthropic API's `web_search_20250305` tool is a **server-side tool** — meaning Anthropic executes the search and returns results inline. However, the model may still return `stop_reason: "tool_use"` when it wants to do multiple searches.

**Current issue**: The continuation loop sends back `"Search completed."` as the tool result for `server_tool_use` blocks. This may not be the correct pattern. Review the Anthropic docs for the proper way to handle server-side tool continuations:
- https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/web-search

**Tasks**:
- Test with a task that requires multiple searches (e.g., "Local News Digest" which should search Lakeland Ledger, Tampa Bay Times, etc.)
- Verify the continuation loop works or fix it based on current API docs
- Add timeout/max-iterations guard (cap at 5 continuation loops)
- Add error handling for rate limits (429s) with exponential backoff

### 2b-2: Activity Log Detail View

The Dashboard's Activity Log currently shows truncated summaries. Add an expandable detail view.

**File**: `frontend/components/CommandCenter.jsx`

**Requirements**:
- Click any activity log entry to expand it
- Show full structured log: Goal, Strategy, Results, Learnings
- Show flag status and flag note prominently if flagged
- Show API cost
- Show timestamp
- Show which task generated it (link back to task)
- Collapsible — click again to close

**Backend**: The activity_log table already has `goal`, `strategy`, `results`, `learnings`, `api_cost` columns. The `/api/activity/` endpoint returns them. The frontend just needs to display them.

### 2b-3: Chat History Persistence & UX

**Requirements**:
- Chat messages persist in Supabase (already working)
- Add timestamps to chat bubbles (small, muted text below each message)
- Add a "Clear Chat" button that deletes all messages
- Add a loading skeleton while chat history loads
- Auto-scroll to bottom on new messages (already working, verify)
- Handle long agent responses with proper text wrapping and markdown rendering
- Consider adding basic markdown rendering (bold, links, lists) for agent responses

### 2b-4: Error Handling & Feedback

**Requirements**:
- If ▶ RUN fails, show an inline error on the task card (red text, auto-dismiss after 5s)
- If chat send fails, show the failed message with a retry button
- Add toast/notification system for success ("Task completed") and error states
- Handle API timeout gracefully (Railway has a 30s default — agent tasks with multiple web searches may exceed this)

**Backend fix for timeouts**:
- Consider making task execution async: POST /tasks/{id}/run returns immediately with a `running` status
- Poll for completion, or use a webhook/SSE pattern
- Alternative: increase Railway timeout to 120s for the run endpoint

---

## Phase 3: Scheduler

### 3-1: APScheduler Integration

The agent needs to run tasks automatically on schedule without Wesley hitting ▶ RUN.

**File**: `backend/services/scheduler.py` (exists as placeholder)

**Implementation**:
```python
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
```

**Schedule mapping**:
| Frequency | Cron | Time (ET) | Notes |
|-----------|------|-----------|-------|
| Daily | `0 7 * * *` | 7:00 AM | Before Wesley's day starts |
| Weekly | `0 7 * * 1` | Monday 7:00 AM | Week kickoff |
| Monthly | `0 7 1 * *` | 1st of month 7:00 AM | Month-end wrap from prior month |
| Quarterly | `0 7 1 1,4,7,10 *` | Q start | Jan, Apr, Jul, Oct |
| Annually | `0 7 2 1 *` | Jan 2 | After New Year |

**Requirements**:
- On app startup, load all active tasks from DB
- Create APScheduler jobs for each based on frequency
- When a task is toggled active/inactive, add/remove the scheduler job
- When a task's frequency changes (drag-drop), reschedule it
- Each execution: call `agent.execute_task()`, save ActivityLog, update `task.last_run`
- Log scheduler events (job added, job executed, job failed)
- Add a `/api/scheduler/status` endpoint showing next run times for all jobs

### 3-2: Scheduler Dashboard Widget

**File**: `frontend/components/CommandCenter.jsx` — Dashboard tab

**Add a "Next Up" panel** showing:
- Next 5 tasks scheduled to run, with countdown timers
- Last run time for each task
- Ability to skip next run or run now

### 3-3: Batch Execution

When multiple daily tasks fire at 7 AM, they shouldn't all hit the API simultaneously.

**Requirements**:
- Queue tasks and execute sequentially with 5-second gaps
- If one fails, continue to next (don't block the batch)
- Log batch summary: "Daily batch: 4/4 complete, 1 flagged, $0.12 total cost"
- Add batch summary to activity log

---

## Phase 4: Communication Layer

### 4-1: SMS via Twilio

Wesley wants to receive flagged items and daily summaries via text.

**Setup**:
- Add Twilio credentials to Railway env: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`, `WESLEY_PHONE_NUMBER`
- Install: `twilio` package

**File**: `backend/services/notifications.py`

**Notification triggers**:
1. **Flagged items**: When any task execution sets `flag: True`, immediately SMS Wesley the flag_note
2. **Daily digest**: After all daily tasks complete, send a summary SMS
   - Format: "BASed Daily: 4 tasks done. 1 flagged: [flag_note]. Cost: $0.08"
3. **Proposal alerts**: When agent creates a new proposal, SMS Wesley for approval
4. **Error alerts**: If a critical task fails, notify Wesley

**SMS format guidelines**:
- Keep under 160 chars when possible (single SMS segment)
- Lead with urgency level: 🔴 (flag), 🟡 (info), 🟢 (all clear)
- Include a link to the dashboard for details

### 4-2: Email Reports

For weekly/monthly/quarterly summaries, SMS is too short. Send email digests.

**Setup**:
- Use Resend (resend.com) or SendGrid for transactional email
- Add API key to Railway env

**Email templates** (HTML):
1. **Weekly Summary**: All activity from the week, flagged items, task completion rate, total API cost, upcoming tasks
2. **Monthly Report**: Aggregated stats, entity-level summaries, cost trends, agent performance
3. **Quarterly Review**: Investment portfolio updates, board prep summaries, philanthropy tracking

### 4-3: Two-Way SMS (Stretch)

Allow Wesley to respond to SMS notifications:
- Reply "approve" to proposal alerts → auto-approve
- Reply "skip [task]" → skip next scheduled run
- Reply "run [task]" → trigger on-demand execution
- Requires Twilio webhook endpoint: `POST /api/sms/incoming`

---

## Phase 5: Proposal System

### 5-1: Agent-Generated Proposals

The agent should proactively suggest new tasks and initiatives.

**When to propose**:
- During task execution, if the agent discovers something that warrants a new standing order
- If a news item suggests a new monitoring need
- If the agent notices a gap in coverage (e.g., no task monitors a key entity)

**Implementation**:
- Add a `propose()` method to `AgentCore`
- After each task execution, give the agent an optional prompt: "Based on what you just found, should Wesley add any new standing orders or take any action? If yes, create a proposal."
- Proposal schema: `{ title, rationale, project, effort, proposed_task }` where `proposed_task` is a full task definition the agent would execute if approved

**File**: `backend/services/agent.py` — add `propose()` method
**File**: `backend/routers/run_task.py` — after task execution, optionally call propose

### 5-2: Proposal Approval Flow

**Backend**:
- `PATCH /api/proposals/{id}/resolve` already exists
- When approved: auto-create the proposed task in the tasks table, add to scheduler
- When declined: log reason, agent learns not to re-propose similar items

**Frontend**:
- Dashboard Proposals panel already has Approve/Decline buttons
- Add a preview of the proposed task (name, description, frequency, project)
- Add a "modify and approve" option — Wesley can edit the task before approving

---

## Phase 6: External Data Sources

### 6-1: Publix Stock Monitor

**Task**: "Publix Stock Check" (daily)
**Source**: Publix is private/employee-owned, so no public ticker. Monitor via:
- Publix stock price page (publix.com — they publish quarterly)
- SEC EDGAR filings for Publix Super Markets Inc
- News about Publix financial performance

**Implementation**:
- Web search handles this for now
- Future: scrape Publix investor page for exact stock price when published
- Flag when new quarterly price is announced (Jenkins family owns ~20%)

### 6-2: STR Hotel Data

**Task**: "SpringHill STR Report" (weekly)
**Source**: STR (Smith Travel Research) provides hotel performance data
- RevPAR, ADR, Occupancy for SpringHill Suites Lakeland
- Comp set performance
- Market trends

**Implementation**:
- STR has an API (requires subscription/login)
- If API not available, agent searches for Lakeland hotel market news
- Future: integrate STR Connect API when credentials available
- Store historical data points in a new `metrics` table for trend tracking

### 6-3: CoStar / Real Estate Data

**Task**: "Lakeland Market Intel" (monthly)
**Source**: CoStar, Zillow, Redfin, local MLS
- Commercial real estate trends in Lakeland/Polk County
- Notable transactions, new developments, zoning changes

**Implementation**:
- Web search for now
- Future: CoStar API integration (requires enterprise subscription)

### 6-4: News Monitoring (Enhanced)

Current "Local News Digest" uses web search. Enhance with:
- RSS feed parsing for Lakeland Ledger, Tampa Bay Times, Tampa Bay Business Journal
- Google News API for entity-specific alerts
- Store articles in a new `news_items` table to avoid duplicates
- Tag articles by relevant entity (Publix, BSP, Florida Poly, etc.)

**New table: `news_items`**
```sql
CREATE TABLE news_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    url TEXT,
    source TEXT,
    summary TEXT,
    entities TEXT[], -- array of entity IDs mentioned
    relevance_score FLOAT,
    flagged BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT now()
);
```

### 6-5: Google Calendar Integration

**Task**: "Calendar & Agenda Briefing" (daily)
**Source**: Google Calendar API

**Setup**:
- Create Google Cloud project, enable Calendar API
- OAuth2 flow or service account with calendar access
- Store refresh token in Railway env

**Implementation**:
- Pull today's events + next 3 days
- Summarize schedule, flag conflicts
- Note prep needed for upcoming meetings (e.g., board meetings, investor calls)
- Cross-reference with entity knowledge base (meeting with someone from an entity → pull context)

### 6-6: Gmail Integration (Stretch)

**Source**: Gmail API
- Scan inbox for emails from key contacts (board members, partners, etc.)
- Summarize unread important emails
- Flag urgent items
- Cross-reference senders with entity knowledge base

---

## Phase 7: Intelligence Layer

### 7-1: Metrics & Trends Table

Track quantitative data points over time for trend analysis.

**New table: `metrics`**
```sql
CREATE TABLE metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id TEXT REFERENCES entities(id),
    metric_name TEXT NOT NULL,  -- e.g., 'revpar', 'stock_price', 'occupancy'
    value FLOAT NOT NULL,
    unit TEXT,  -- e.g., 'USD', '%', 'visitors'
    period TEXT,  -- e.g., '2025-Q1', '2025-02', '2025-W07'
    source TEXT,  -- where this data came from
    created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_metrics_entity ON metrics(entity_id);
CREATE INDEX idx_metrics_name ON metrics(metric_name);
```

**Use cases**:
- Track SpringHill RevPAR week over week
- Track Publix stock price quarter over quarter
- Track Bonnet Springs Park visitor counts
- Track API costs over time
- Agent can reference trends: "RevPAR is up 8% vs last month"

### 7-2: Agent Memory / Learning

The agent should get smarter over time by remembering what it's learned.

**New table: `agent_memory`**
```sql
CREATE TABLE agent_memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category TEXT NOT NULL,  -- 'entity_fact', 'preference', 'contact', 'decision'
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    source TEXT,  -- which task/chat produced this
    confidence FLOAT DEFAULT 1.0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(category, key)
);
```

**How it works**:
- After each task execution, agent extracts key facts and stores them
- Before each task execution, agent loads relevant memories as additional context
- Examples:
  - `entity_fact / springhill_gm`: "Sarah Johnson is the current GM at SpringHill Suites"
  - `preference / report_style`: "Wesley prefers bullet points over paragraphs for daily summaries"
  - `contact / str_rep`: "Our STR account rep is Mike at mike@str.com"
  - `decision / lvi_thesis`: "LVI's investment thesis focuses on Florida-based tech startups"

### 7-3: Dashboard Analytics

Add a 5th tab to the dashboard: **Analytics**

**Panels**:
1. **Cost Tracker**: Line chart of daily API spend, cumulative monthly total, projected monthly cost
2. **Task Performance**: Completion rate by frequency, average execution time, flag rate
3. **Entity Activity**: Which entities generate the most flags/activity
4. **Agent Efficiency**: Tasks per day, cost per task, search queries per task

**Implementation**:
- Backend: Add `/api/analytics/` endpoints that aggregate activity_log data
- Frontend: Use recharts (already available in the stack) for visualizations

---

## Phase 8: Self-Building Loop

### 8-1: Agent Self-Evaluation

Weekly meta-task where the agent reviews its own performance:
- Which tasks produced useful results?
- Which tasks failed or produced low-value output?
- What gaps exist in the current task roster?
- What entities are under-monitored?

**Output**: Proposals for new tasks, modifications to existing tasks, or entity updates.

### 8-2: Auto-Configuration

When Wesley approves a proposal that requires a new data source:
- Agent generates the integration code
- Creates a PR on GitHub (via GitHub API)
- Wesley reviews and merges
- Railway auto-deploys

**This is the endgame**: the agent proposes improvements to itself, Wesley approves, and the system evolves.

---

## Database Schema Summary

### Existing Tables
| Table | Purpose |
|-------|---------|
| entities | Knowledge base — 13 entities defining Wesley's world |
| tasks | 24 standing orders with frequency, project, active/urgent flags |
| activity_log | Structured logs from every task execution |
| proposals | Agent-generated suggestions awaiting Wesley's approval |
| chat_messages | Chat history between Wesley and the agent |

### New Tables (to add)
| Table | Phase | Purpose |
|-------|-------|---------|
| news_items | 6 | Deduplicated news articles tagged by entity |
| metrics | 7 | Quantitative data points for trend tracking |
| agent_memory | 7 | Persistent facts the agent learns over time |

---

## Environment Variables (Railway)

### Currently Set
| Variable | Value |
|----------|-------|
| DATABASE_URL | Supabase shared pooler connection string |
| ANTHROPIC_API_KEY | Real API key |
| FRONTEND_URL | https://barnett-automated-services.vercel.app |
| APP_ENV | production |

### To Add
| Variable | Phase | Purpose |
|----------|-------|---------|
| TWILIO_ACCOUNT_SID | 4 | SMS notifications |
| TWILIO_AUTH_TOKEN | 4 | SMS notifications |
| TWILIO_FROM_NUMBER | 4 | SMS sender number |
| WESLEY_PHONE_NUMBER | 4 | SMS recipient |
| RESEND_API_KEY | 4 | Email reports |
| WESLEY_EMAIL | 4 | Email recipient |
| GOOGLE_CALENDAR_CREDENTIALS | 6 | Calendar integration |
| GOOGLE_GMAIL_CREDENTIALS | 6 | Gmail integration (stretch) |

---

## File Structure

```
Barnett-Automated-Services/
├── backend/
│   ├── main.py                    # FastAPI app, CORS, router mounting
│   ├── requirements.txt           # Python dependencies
│   ├── core/
│   │   ├── config.py              # Settings from env vars
│   │   └── database.py            # SQLAlchemy engine + session
│   ├── models/
│   │   ├── db_models.py           # SQLAlchemy ORM models
│   │   └── schemas.py             # Pydantic request/response schemas
│   ├── routers/
│   │   ├── entities.py            # CRUD for entities
│   │   ├── tasks.py               # CRUD for tasks
│   │   ├── activity.py            # CRUD for activity log
│   │   ├── proposals.py           # CRUD + resolve for proposals
│   │   ├── chat.py                # Chat endpoint (calls agent)
│   │   ├── run_task.py            # On-demand task execution
│   │   ├── analytics.py           # [Phase 7] Aggregation endpoints
│   │   └── sms.py                 # [Phase 4] Twilio webhook
│   ├── services/
│   │   ├── agent.py               # Agent core — Claude API + web search
│   │   ├── scheduler.py           # [Phase 3] APScheduler integration
│   │   ├── notifications.py       # [Phase 4] SMS + email
│   │   └── integrations/          # [Phase 6] External data sources
│   │       ├── calendar.py
│   │       ├── news.py
│   │       └── metrics.py
│   └── seed.py                    # Initial data seeding
├── frontend/
│   ├── components/
│   │   └── CommandCenter.jsx      # Main dashboard UI
│   ├── lib/
│   │   └── api.js                 # API client
│   ├── app/
│   │   ├── layout.js
│   │   └── page.js
│   ├── package.json
│   └── next.config.mjs
├── LOGGING.md                     # Agent logging format spec
├── ARCHITECTURE.md                # System architecture doc
└── README.md
```

---

## Priority Order

If implementing sequentially, this is the recommended order:

1. **Phase 2b-1**: Fix web search continuation (unblocks all task execution)
2. **Phase 2b-2**: Activity log detail view (see what the agent actually did)
3. **Phase 3-1**: Scheduler (agent runs automatically)
4. **Phase 3-3**: Batch execution (daily tasks queue properly)
5. **Phase 4-1**: SMS notifications (Wesley gets flagged items on his phone)
6. **Phase 5-1**: Agent proposals (agent starts suggesting improvements)
7. **Phase 2b-4**: Async task execution (prevents timeouts on complex tasks)
8. **Phase 6-5**: Google Calendar (highest-value integration)
9. **Phase 7-1**: Metrics table (enables trend tracking)
10. **Phase 7-2**: Agent memory (agent gets smarter)
11. **Phase 7-3**: Analytics dashboard (visibility into agent performance)
12. **Phase 6-4**: Enhanced news monitoring (RSS feeds, deduplication)
13. **Phase 4-2**: Email reports (weekly/monthly digests)
14. **Phase 8**: Self-building loop (endgame)

---

## Key Technical Notes

- **Database driver**: Using `pg8000` (pure Python) instead of `psycopg2` because Railway doesn't have `libpq`
- **Connection string**: Must use `postgresql+pg8000://` dialect in SQLAlchemy
- **Supabase pooler**: Using shared pooler on port 6543 (IPv4 compatible)
- **Password encoding**: `%` in password must be URL-encoded as `%25`
- **CORS**: Vercel domain explicitly allowed in FastAPI middleware
- **Railway port**: App listens on `$PORT` (8080), public domain routes to it
- **Anthropic web search**: Server-side tool (`web_search_20250305`), Anthropic executes searches
- **API cost tracking**: Sonnet pricing at $3/M input, $15/M output tokens
- **Frontend**: Single-page React app, all state managed with hooks, dark theme with IBM Plex fonts
- **Task IDs**: Short string IDs (e.g., "cal", "email", "news") — not UUIDs
- **Entity IDs**: Short string IDs (e.g., "bfp", "lvi", "tbv") — not UUIDs

---

## Credentials to Rotate

⚠️ The Supabase database password (`gondolagang666%`) was shared in chat during setup. Rotate it:
1. Go to Supabase → Project Settings → Database
2. Reset password
3. Update `DATABASE_URL` in Railway with new password (remember to URL-encode `%` as `%25`)
