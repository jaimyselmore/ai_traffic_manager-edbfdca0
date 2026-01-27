# Ellen Architectuur

## Systeem Overzicht

```
┌─────────────────────────────────────────────────────────────┐
│                         FRONTEND                             │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐      ┌──────────────┐     ┌────────────┐ │
│  │   Templates  │      │  Ellen Chat  │     │ Dashboard  │ │
│  │              │      │    Page      │     │            │ │
│  │ - Meeting    │─────▶│              │◀────│  "Ask      │ │
│  │ - Wijziging  │      │  Chat UI     │     │   Ellen"   │ │
│  │ - Verlof     │      │  Component   │     │            │ │
│  │ - Project    │      │              │     │            │ │
│  └──────────────┘      └──────┬───────┘     └────────────┘ │
│                                │                             │
│                                │ POST /ellen-chat            │
└────────────────────────────────┼─────────────────────────────┘
                                 │
┌────────────────────────────────┼─────────────────────────────┐
│                    SUPABASE EDGE FUNCTION                     │
├────────────────────────────────┼─────────────────────────────┤
│                                ▼                              │
│                     ┌────────────────────┐                    │
│                     │  ellen-chat/       │                    │
│                     │  index.ts          │                    │
│                     │                    │                    │
│                     │  1. Load Context   │                    │
│                     │  2. Init LangChain │                    │
│                     │  3. Call Claude    │                    │
│                     │  4. Execute Tools  │                    │
│                     │  5. Return Response│                    │
│                     └─────────┬──────────┘                    │
│                               │                               │
│           ┌───────────────────┼──────────────────┐           │
│           │                   │                  │           │
│           ▼                   ▼                  ▼           │
│    ┌──────────┐        ┌──────────┐      ┌──────────┐      │
│    │ Context  │        │ LangChain│      │  Tools   │      │
│    │ Loader   │        │ + Claude │      │          │      │
│    │          │        │   API    │      │ - Query  │      │
│    │ - Load   │        │          │      │ - Action │      │
│    │   data   │        │ Function │      │ - Helper │      │
│    │ - Format │        │  calling │      │          │      │
│    └──────────┘        └──────────┘      └────┬─────┘      │
│                                                │             │
└────────────────────────────────────────────────┼─────────────┘
                                                 │
┌────────────────────────────────────────────────┼─────────────┐
│                      SUPABASE DATABASE          │             │
├────────────────────────────────────────────────┼─────────────┤
│                                                ▼             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │projecten │  │  taken   │  │meetings  │  │medewerkers│   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                 │
│  │ klanten  │  │  verlof  │  │conversations│              │
│  └──────────┘  └──────────┘  └──────────┘                 │
└─────────────────────────────────────────────────────────────┘
```

## Technologie Stack

### Frontend
- **React** - UI framework
- **TypeScript** - Type safety
- **TanStack Query** - Data fetching & caching
- **Supabase Client** - Database & Auth

### Backend (Supabase Edge Functions)
- **Deno** - Runtime environment
- **LangChain.js** - LLM orchestration framework
- **Claude API** (Anthropic) - Large Language Model
- **Supabase Client** - Database access

### Database
- **PostgreSQL** (via Supabase) - All structured data
- **RLS Policies** - Row Level Security

## Data Flow

### 1. Template Submission Flow
```
User fills template (Meeting/Wijziging/Verlof)
       ↓
Template collects structured data
       ↓
Navigate to Ellen Chat with formData
       ↓
Ellen analyzes formData + current planning context
       ↓
Ellen proposes actions (Create meeting, adjust planning, etc.)
       ↓
User confirms
       ↓
Ellen executes via tools (database updates)
       ↓
Planner reflects changes
```

### 2. Ellen Chat Flow
```
User sends message
       ↓
Frontend calls edge function: ellen-chat
       ↓
Edge function loads context:
  - Current projects (with titels!)
  - Team capacity
  - Upcoming deadlines
  - Recent changes
       ↓
Format system prompt + user message + context
       ↓
Send to Claude via LangChain
       ↓
Claude responds with:
  - Natural language response
  - Function calls (tool invocations)
       ↓
Execute tool calls (if any)
       ↓
Return formatted response to frontend
       ↓
Display in chat UI + optional action buttons
```

## Component Breakdown

### Frontend Components

**`/src/pages/EllenChatPage.tsx`**
- Main chat interface
- Message history
- Input field
- Action confirmation buttons

**`/src/components/chat/EllenChat.tsx`**
- Reusable chat UI component
- Message rendering
- Loading states
- Error handling

**`/src/contexts/EllenContext.tsx`** (To be created)
- Conversation history
- Pending actions
- State management

### Backend Functions

**`supabase/functions/ellen-chat/index.ts`**
- HTTP handler
- Authentication check
- Message routing
- Response formatting

**`supabase/functions/ellen-chat/context-loader.ts`**
- Load current projects
- Get team availability
- Fetch recent changes
- Format for LLM

**`supabase/functions/ellen-chat/tools.ts`**
- Tool definitions (function schemas)
- Tool implementations
- Error handling

**`supabase/functions/ellen-chat/prompt.ts`**
- System prompt template
- Role definition
- Instruction sets

### Service Layer

**`/src/lib/services/ellenService.ts`** (To be created)
- API client for ellen-chat endpoint
- Error handling
- Type definitions

**`/src/lib/services/ellen-tools.ts`** (To be created)
- Tool type definitions
- Tool result parsers
- Action confirmation helpers

## Security Model

### Authentication
- All requests to ellen-chat require valid Supabase session
- Session token passed in Authorization header
- RLS policies enforce data access control

### Authorization
- Ellen can only access data user has permission for
- Tool executions respect RLS policies
- Hard-locked items cannot be modified

### API Key Management
- Claude API key stored in Supabase secrets
- Never exposed to frontend
- Rate limiting on edge function

## Performance Considerations

### Context Loading
- **Target**: <500ms
- **Strategy**:
  - Cache frequently accessed data
  - Only load relevant time window (current week + 2 weeks ahead)
  - Use database indexes on commonly filtered fields

### LLM Response Time
- **Target**: <5 seconds
- **Strategy**:
  - Use Claude Haiku for simple queries (faster, cheaper)
  - Use Claude Sonnet for complex planning (slower, better reasoning)
  - Stream responses when possible

### Concurrent Requests
- **Limit**: Max 3 concurrent conversations per user
- **Why**: Prevent race conditions in planning updates

## Scalability

### Current Bottlenecks
1. LLM API latency (2-5 seconds per call)
2. Context loading from database (hundreds of tasks)
3. Slot finding algorithm (O(n*m) complexity)

### Future Optimizations
1. **Caching**: Redis layer for frequently accessed context
2. **Pre-computation**: Capacity summaries updated on task changes
3. **Streaming**: Real-time response streaming to frontend
4. **Parallel tools**: Execute independent tool calls concurrently

## Deployment

### Development
```bash
# Start frontend
npm run dev

# Deploy edge function (local)
supabase functions serve ellen-chat

# Test edge function
curl -X POST http://localhost:54321/functions/v1/ellen-chat \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"message": "Hello Ellen"}'
```

### Production
```bash
# Deploy edge function
supabase functions deploy ellen-chat

# Set secrets
supabase secrets set ANTHROPIC_API_KEY=your_key_here
```

## Monitoring & Observability

### Metrics to Track
- Edge function invocation count
- Average response time
- LLM token usage
- Error rate
- Tool execution success rate

### Logging
- All Ellen interactions logged to `ellen_conversations` table
- Tool executions logged with timestamps
- Errors sent to Supabase error tracking

## Future Enhancements

### Phase 2
- **Proactive notifications**: Ellen monitors planning and alerts on issues
- **Batch operations**: Process multiple projects at once
- **Learning**: Improve suggestions based on user feedback

### Phase 3
- **Voice interface**: Talk to Ellen
- **Email integration**: Ellen can respond to emails
- **Advanced analytics**: Predict capacity issues before they happen
