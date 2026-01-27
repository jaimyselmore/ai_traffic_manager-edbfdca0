# Ellen Implementation Plan

Stap-voor-stap plan om Ellen (AI Planning Agent) te bouwen en te integreren in het AI Traffic Manager systeem.

## Overzicht

**Doel:** Ellen volledig werkend krijgen zodat zij:
- Templates kan verwerken (Meeting, Wijziging, Verlof)
- Planning kan automatiseren
- Met gebruikers kan communiceren via chat
- Intelligente suggesties kan doen

**Geschatte totale tijd:** 5-7 dagen (1 developer, full-time)

---

## FASE 0: Voorbereidingen (Huidige stap)

### ✅ Al gedaan:
- Planning automation service (`planningAutomation.ts`)
- Database schema (alle tabellen)
- Template forms (Meeting, Wijziging, Verlof)
- Chat UI component (`EllenChat.tsx`)
- Project titel generatie werkend

### ⏳ Nog te doen:
- [ ] Fix titel integratie in Meeting template
- [ ] Fix titel support in ExistingProjectSelector
- [ ] Update dataService.ts om titel op te halen
- [ ] Test dat alle templates correcte data doorgeven

**Tijd:** 0.5 dag

---

## FASE 1: Backend Foundation (2-3 dagen)

### Stap 1.1: Supabase Edge Function Setup
**Bestand:** `supabase/functions/ellen-chat/index.ts`

**Taken:**
```typescript
1. Create basic edge function structure
   - HTTP handler (POST endpoint)
   - CORS headers
   - Authentication check
   - Error handling

2. Input/Output types
   - Request: { message: string, context?: any }
   - Response: { response: string, actions?: Action[] }

3. Test with simple echo response
```

**Dependencies:**
```bash
# In supabase/functions/ellen-chat/
deno install \
  npm:@langchain/anthropic \
  npm:@langchain/core \
  npm:langchain \
  npm:@supabase/supabase-js
```

**Test:**
```bash
supabase functions serve ellen-chat
curl -X POST http://localhost:54321/functions/v1/ellen-chat \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"message": "Hello"}'
```

**Tijd:** 0.5 dag

---

### Stap 1.2: LangChain + Claude Integration
**Bestand:** `supabase/functions/ellen-chat/llm.ts`

**Taken:**
```typescript
1. Initialize Claude via LangChain
   - API key from environment
   - Model selection (Sonnet vs Haiku)
   - Temperature settings

2. Basic prompt template
   - System prompt defining Ellen's role
   - User message handling
   - Response formatting

3. Test LLM connection
   - Send simple query
   - Receive response
   - Log token usage
```

**Code snippet:**
```typescript
import { ChatAnthropic } from "@langchain/anthropic";

const llm = new ChatAnthropic({
  apiKey: Deno.env.get("ANTHROPIC_API_KEY"),
  modelName: "claude-3-5-sonnet-20241022",
  temperature: 0.2,
});

const systemPrompt = `
Je bent Ellen, een slimme planning assistent voor een productiebureau.
Je helpt met het plannen van projecten, meetings, en het beheren van capaciteit.
Je spreekt Nederlands en bent vriendelijk maar professioneel.
`;

const response = await llm.invoke([
  { role: "system", content: systemPrompt },
  { role: "user", content: userMessage }
]);
```

**Test:**
- Send "Wie ben je?" → Should respond as Ellen
- Send "Wat kun je doen?" → Should list capabilities

**Tijd:** 0.5 dag

---

### Stap 1.3: Context Loader
**Bestand:** `supabase/functions/ellen-chat/context.ts`

**Taken:**
```typescript
1. Load current projects
   - Active projects (status != 'afgerond')
   - Include titel, deadline, team
   - Order by deadline (soonest first)

2. Load team capacity
   - All employees with their disciplines
   - Busy hours this week
   - Upcoming verlof

3. Format for LLM
   - Markdown format
   - Relevant details only
   - Keep under 4000 tokens

4. Cache strategy
   - Cache for 5 minutes
   - Invalidate on relevant changes
```

**Code snippet:**
```typescript
async function loadContext(supabaseClient) {
  // Projects
  const { data: projects } = await supabaseClient
    .from('projecten')
    .select(`
      projectTitel,
      klantNaam:klanten(naam),
      deadline,
      status,
      fases:project_fases(naam, medewerkers)
    `)
    .neq('status', 'afgerond')
    .order('deadline', { ascending: true })
    .limit(20);

  // Team capacity
  const { data: employees } = await supabaseClient
    .from('medewerkers')
    .select('naam_werknemer, discipline, beschikbaar');

  // Format as markdown
  return `
## Huidige Projecten
${projects.map(p => `- ${p.projectTitel} (deadline: ${p.deadline})`).join('\n')}

## Team
${employees.map(e => `- ${e.naam_werknemer} (${e.discipline})`).join('\n')}
  `;
}
```

**Tijd:** 1 dag

---

### Stap 1.4: Tool Definitions
**Bestand:** `supabase/functions/ellen-chat/tools.ts`

**Taken:**
```typescript
1. Define essential tools (start met 5):
   - get_project_details
   - check_employee_availability
   - schedule_meeting
   - get_schedule_conflicts
   - analyze_capacity

2. Tool schemas (OpenAI format)
3. Tool implementations
4. Error handling per tool
```

**Code snippet:**
```typescript
const tools = [
  {
    name: "get_project_details",
    description: "Haal volledige project informatie op",
    parameters: {
      type: "object",
      properties: {
        project_id: {
          type: "string",
          description: "UUID van het project"
        }
      },
      required: ["project_id"]
    }
  },
  // ... more tools
];

async function executeTool(toolName, params, supabaseClient) {
  switch (toolName) {
    case "get_project_details":
      return await getProjectDetails(params.project_id, supabaseClient);
    // ... more cases
    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}
```

**Tijd:** 1 dag

---

## FASE 2: Frontend Integration (1-2 dagen)

### Stap 2.1: Ellen Service Layer
**Bestand:** `/src/lib/services/ellenService.ts`

**Taken:**
```typescript
1. API client for ellen-chat endpoint
2. Request/response types
3. Error handling
4. Retry logic
```

**Code snippet:**
```typescript
export interface EllenMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface EllenResponse {
  message: string;
  actions?: EllenAction[];
}

export interface EllenAction {
  type: 'schedule_meeting' | 'apply_changes';
  label: string;
  data: any;
}

export async function sendMessageToEllen(
  message: string,
  context?: any
): Promise<EllenResponse> {
  const { data: session } = await supabase.auth.getSession();

  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/ellen-chat`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session?.session?.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message, context })
    }
  );

  if (!response.ok) {
    throw new Error('Ellen request failed');
  }

  return response.json();
}
```

**Tijd:** 0.5 dag

---

### Stap 2.2: Ellen Context Provider
**Bestand:** `/src/contexts/EllenContext.tsx`

**Taken:**
```typescript
1. State management:
   - Conversation history
   - Pending actions
   - Loading states

2. Actions:
   - sendMessage()
   - confirmAction()
   - clearHistory()

3. LocalStorage persistence
```

**Code snippet:**
```typescript
interface EllenContextType {
  messages: EllenMessage[];
  isLoading: boolean;
  sendMessage: (message: string) => Promise<void>;
  confirmAction: (action: EllenAction) => Promise<void>;
  clearHistory: () => void;
}

export const EllenContext = createContext<EllenContextType | null>(null);

export function EllenProvider({ children }) {
  const [messages, setMessages] = useState<EllenMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const sendMessage = async (message: string) => {
    setIsLoading(true);

    // Add user message
    const userMsg = { role: 'user', content: message, timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);

    try {
      // Call Ellen
      const response = await sendMessageToEllen(message);

      // Add Ellen's response
      const ellenMsg = { role: 'assistant', content: response.message, timestamp: new Date().toISOString() };
      setMessages(prev => [...prev, ellenMsg]);
    } catch (error) {
      console.error('Ellen error:', error);
      // Show error message
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <EllenContext.Provider value={{ messages, isLoading, sendMessage, confirmAction, clearHistory }}>
      {children}
    </EllenContext.Provider>
  );
}
```

**Tijd:** 0.5 day

---

### Stap 2.3: Update EllenChatPage
**Bestand:** `/src/pages/EllenChatPage.tsx`

**Taken:**
```typescript
1. Remove mock responses
2. Connect to EllenContext
3. Handle template context (if navigated from template)
4. Show action buttons for confirmations
5. Loading & error states
```

**Code snippet:**
```typescript
export default function EllenChatPage() {
  const { messages, isLoading, sendMessage, confirmAction } = useEllenContext();
  const location = useLocation();

  // Check if navigated from template
  const templateContext = location.state?.formData;

  useEffect(() => {
    if (templateContext) {
      // Auto-send template data to Ellen
      const message = generateTemplateMessage(templateContext);
      sendMessage(message);
    }
  }, []);

  return (
    <div className="h-full flex flex-col">
      <EllenChat
        messages={messages}
        onSendMessage={sendMessage}
        isLoading={isLoading}
      />

      {/* Action buttons */}
      {messages[messages.length - 1]?.actions?.map(action => (
        <Button
          key={action.type}
          onClick={() => confirmAction(action)}
        >
          {action.label}
        </Button>
      ))}
    </div>
  );
}
```

**Tijd:** 0.5 dag

---

### Stap 2.4: Add Ellen Route
**Bestand:** `/src/App.tsx`

**Taken:**
```typescript
1. Add route for Ellen chat
2. Wrap in EllenProvider
3. Protected route (requires auth)
```

**Code snippet:**
```typescript
import EllenChatPage from "./pages/EllenChatPage";
import { EllenProvider } from "@/contexts/EllenContext";

// In Routes:
<Route
  path="/ellen-session"
  element={
    <ProtectedRoute>
      <EllenProvider>
        <EllenChatPage />
      </EllenProvider>
    </ProtectedRoute>
  }
/>
```

**Tijd:** 0.1 dag

---

## FASE 3: Template Integration (1 dag)

### Stap 3.1: Fix Meeting Template
**Bestand:** `/src/pages/Meeting.tsx`

**Taken:**
```typescript
1. Replace klanten dropdown with ProjectSelector
2. Add optional "Doel" field
3. Update navigation to ellen-session with correct data
4. Test full flow
```

**Changes:**
```typescript
// BEFORE:
<Select value={formData.projectId}>
  {clients.map(client => (
    <SelectItem value={client.id}>{client.name}</SelectItem>
  ))}
</Select>

// AFTER:
import { ProjectSelector } from '@/components/forms/ProjectSelector';

<ProjectSelector
  value={formData.projectId}
  onChange={(data) => setFormData({
    ...formData,
    projectId: data.projectId,
    projectTitel: data.projectTitel,
    klantNaam: data.klantNaam
  })}
/>
```

**Tijd:** 0.3 dag

---

### Stap 3.2: Fix Wijziging Template
**Bestand:** `/src/pages/Wijzigingsverzoek.tsx`

**Taken:**
```typescript
1. Update ExistingProjectSelector to use ProjectSelector (with titel)
2. Add missing fields:
   - Reden (dropdown)
   - Huidige situatie (textarea)
   - Gewenste situatie (textarea)
   - Impact scope (dropdown)
   - Urgentie (dropdown)
3. Update data passed to Ellen
```

**Tijd:** 0.4 dag

---

### Stap 3.3: Fix Verlof Template
**Bestand:** `/src/pages/Verlof.tsx`

**Taken:**
```typescript
1. Add Verlof categorie (Gepland/Urgent)
2. Add Backup persoon selector (optional)
3. Show betrokken projecten (readonly, auto-fetch)
4. Update data passed to Ellen
```

**Tijd:** 0.3 dag

---

## FASE 4: Testing & Refinement (1 dag)

### Stap 4.1: Integration Tests

**Test scenarios:**
```
1. Meeting Scheduling
   ✓ Happy path - vrije slot gevonden
   ✓ Conflict - alternatief voorgesteld
   ✓ Template → Ellen → Confirmation → Database

2. Wijzigingsverzoek
   ✓ Impact analyse correct
   ✓ Deadline berekening klopt
   ✓ Wijzigingen toegepast in database

3. Verlof
   ✓ Conflicterende taken gedetecteerd
   ✓ Herverdeling voorgesteld
   ✓ Verlof geregistreerd in database

4. General Chat
   ✓ Context wordt correct geladen
   ✓ Project titels worden herkend
   ✓ Conversatie history blijft behouden
```

**Tijd:** 0.5 dag

---

### Stap 4.2: Prompt Engineering

**Refine system prompts:**
```
1. Ellen's personality
   - Professional maar vriendelijk
   - Duidelijk over beperkingen
   - Vraagt om confirmatie bij belangrijke acties

2. Output formatting
   - Structured responses
   - Clear action buttons
   - Explain rationale

3. Error handling
   - Graceful degradation
   - Fallback to manual forms
   - Clear error messages
```

**Tijd:** 0.3 dag

---

### Stap 4.3: Performance Optimization

**Optimize:**
```
1. Context loading
   - Only load last 2 weeks + next 4 weeks
   - Cache frequently accessed data
   - Lazy load project details

2. LLM calls
   - Use Haiku for simple queries
   - Use Sonnet for complex planning
   - Implement request deduplication

3. Database queries
   - Add indexes on commonly filtered fields
   - Use database views for complex joins
   - Batch queries where possible
```

**Tijd:** 0.2 day

---

## FASE 5: Deployment & Monitoring (0.5 dag)

### Stap 5.1: Production Deployment

**Checklist:**
```bash
# 1. Deploy edge function
supabase functions deploy ellen-chat

# 2. Set secrets
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...

# 3. Deploy frontend
git push origin main
# (Loveable auto-deploys)

# 4. Test in production
# - Create test meeting
# - Verify database updates
# - Check error logging
```

**Tijd:** 0.2 dag

---

### Stap 5.2: Monitoring Setup

**Setup:**
```typescript
1. Logging
   - All Ellen interactions → ellen_conversations table
   - Tool executions → ellen_tool_logs table
   - Errors → Supabase error tracking

2. Metrics
   - Average response time
   - Token usage per request
   - Success rate per tool
   - User satisfaction (optional feedback button)

3. Alerts
   - High error rate (>10%)
   - Slow responses (>10s)
   - API quota approaching limit
```

**Tijd:** 0.3 dag

---

## SUCCESS CRITERIA

Ellen implementation is succesvol als:

**Functional:**
- [ ] Ellen kan meetings plannen via chat
- [ ] Ellen kan wijzigingen verwerken
- [ ] Ellen kan verlof registreren
- [ ] Ellen gebruikt project titels correct
- [ ] Ellen geeft nuttige suggesties
- [ ] All actions zijn confirmed by user

**Technical:**
- [ ] Response time < 10 seconds (p95)
- [ ] Error rate < 5%
- [ ] Context loading < 1 second
- [ ] Database writes succeed reliably

**User Experience:**
- [ ] Chat interface is intuitive
- [ ] Action buttons are clear
- [ ] Errors zijn begrijpelijk
- [ ] Fallback naar manual forms werkt

---

## ROLLOUT PLAN

### Week 1: Soft Launch
- Enable voor 2-3 test users
- Monitor closely
- Collect feedback
- Fix critical bugs

### Week 2: Beta
- Enable voor alle internal users
- Document known limitations
- Set up support channel
- Iterate on feedback

### Week 3: Full Launch
- Enable voor alle users
- Announce feature
- Provide training/documentation
- Monitor adoption

---

## KNOWN LIMITATIONS & FUTURE WORK

### Phase 1 Limitations:
- Ellen can't modify hard-locked items
- No real-time collaboration (multiple users editing same project)
- Limited to last 4 weeks of context
- No proactive notifications yet

### Phase 2 Features:
- Proactive alerts (capacity warnings, deadline risks)
- Batch operations (optimize all Q1 projects)
- Learning from past decisions
- Email integration

### Phase 3 Features:
- Voice interface
- Advanced analytics
- Predictive planning
- External calendar sync

---

## SUPPORT & DOCUMENTATION

### User Documentation:
- [ ] "How to use Ellen" guide
- [ ] FAQs
- [ ] Video tutorial
- [ ] Troubleshooting guide

### Developer Documentation:
- [ ] API documentation (edge function)
- [ ] Tool development guide
- [ ] Deployment procedures
- [ ] Architecture diagrams

### Training:
- [ ] Internal demo session
- [ ] User onboarding flow
- [ ] Support team training

---

## ESTIMATED TOTAL TIME

```
Fase 0: Voorbereidingen      0.5 dag
Fase 1: Backend              2.5 dagen
Fase 2: Frontend             1.5 dagen
Fase 3: Templates            1 dag
Fase 4: Testing              1 dag
Fase 5: Deployment           0.5 dag
───────────────────────────────────
TOTAAL:                      7 dagen
```

**Met buffer:** 8-10 dagen (full-time developer)

---

## DEPENDENCIES & RISKS

### External Dependencies:
- Anthropic Claude API availability
- Supabase edge function stability
- LangChain.js updates

### Risks:
1. **LLM latency** - Mitigatie: Use Haiku for simple tasks
2. **Token costs** - Mitigatie: Monitor usage, implement caching
3. **Context window limits** - Mitigatie: Summarize older conversations
4. **User adoption** - Mitigatie: Good UX, clear value proposition

### Critical Path:
```
Backend foundation → Tool definitions → Frontend integration → Template fixes → Testing
```

All steps are sequential, can't be easily parallelized.

---

## NEXT STEPS

**Immediate (deze week):**
1. Fix titel integratie in templates ✓
2. Update dataService.ts ✓
3. Start Supabase edge function setup

**Short term (volgende week):**
1. Complete backend (LLM + tools)
2. Frontend integration
3. First working demo

**Medium term (over 2 weken):**
1. All templates connected
2. Testing & refinement
3. Production deployment

Let's go! 🚀
