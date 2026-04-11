# PHASE 5B — Core Social Completion & Retention Layer
## Implementation Documentation

**Date:** April 11, 2026  
**Status:** ✅ COMPLETE — Build passes, all features implemented

---

## Executive Summary

Phase 5B closes the critical social product gaps identified in the live audit. This phase adds a full messaging system, polishes notifications, fixes search/discovery with combined results, and adds a dedicated settings page — all while preserving the existing governance (4A), verification (4B), and architecture.

### Rules Followed
- ✅ NO duplicate systems created
- ✅ NO second backend structure
- ✅ NO duplicate notification/messaging/search logic
- ✅ Phase 4A (governance) + Phase 4B (verification) untouched
- ✅ Auth, admin, moderation, audit, role systems intact
- ✅ `/admin` remains single governance dashboard
- ✅ `users.role` remains canonical authority
- ✅ `governance_audit_log` remains only audit stream
- ✅ Existing architecture extended only

---

## FEATURE 1 — NOTIFICATION SYSTEM (POLISHED)

### Status: ✅ ALREADY WORKING → POLISHED

The notification system was already 95% functional from prior phases. Phase 5B added:

### Changes Made
1. **`app/api/notifications/route.ts`** — Added `GET` and `PATCH` HTTP handlers
   - `GET /api/notifications` — Fetch notifications for current user (with limit param)
   - `PATCH /api/notifications` — Mark single notification or all as read
   - Existing `POST` handler (create notifications) preserved exactly

2. **`src/components/shared/NotificationBell.tsx`** — UI polish
   - Added explicit "Mark all read" button in dropdown header
   - Added click-outside-to-close behavior via `useRef` + `mousedown` listener
   - Uses `from_user_name` and `from_user_avatar` fields directly (no FK join dependency)
   - Grouped notifications with count display
   - Real-time subscription via Supabase Postgres changes

### Architecture
```
User Action → POST /api/notifications → notifications table → Realtime → NotificationBell
                                                                              ↓
                                                                    GET /api/notifications
                                                                    PATCH /api/notifications
```

### Deduplication
- Server-side: `hasRecentDuplicateNotification()` checks within 20-minute window
- Self-notification skipped (can't notify yourself)

---

## FEATURE 2 — DIRECT MESSAGING (NEW)

### Status: ✅ NEW — Built from scratch

### Database Schema
**File:** `phase5b_messaging_migration.sql` (run in Supabase SQL Editor)

| Table | Fields | Purpose |
|---|---|---|
| `conversations` | id, participant_one, participant_two, last_message_at | 1-to-1 chat rooms |
| `messages` | id, conversation_id, sender_id, content, read | Individual messages |

**Constraints:**
- `unique_conversation(participant_one, participant_two)` — prevents duplicate conversations
- `no_self_chat` — cannot message yourself
- Content: 1–5000 chars
- RLS: users can only access their own conversations/messages

**Trigger:** `update_conversation_last_message` — auto-updates `last_message_at` on new message

### API Routes

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/messages/conversations` | List user's conversations with last message + unread count |
| POST | `/api/messages/conversations` | Create or find existing conversation |
| GET | `/api/messages/[conversationId]` | Fetch messages (auto-marks as read) |
| POST | `/api/messages/[conversationId]` | Send a message |

### Frontend
- **`src/_root/pages/Messages.tsx`** — Full messaging UI
  - Left panel: conversation list with avatars, last message preview, unread badges
  - Right panel: chat view with message bubbles, timestamps, send button
  - New chat modal with user search
  - Responsive: mobile shows one panel at a time
  - Messages poll every 5 seconds for new content
  - Supabase Realtime enabled for `messages` table

### React Query Hooks
| Hook | Key | Notes |
|---|---|---|
| `useGetConversations` | `GET_CONVERSATIONS` | 30s stale time, refetch on focus |
| `useGetMessages` | `GET_MESSAGES` | 10s stale, 5s poll interval |
| `useSendMessage` | mutation | Invalidates messages + conversations |
| `useCreateConversation` | mutation | Invalidates conversations |

---

## FEATURE 3 — SEARCH & DISCOVERY (FIXED)

### Status: ✅ FIXED — Combined user + post search

### Changes Made
**`src/_root/pages/Explore.tsx`** — Enhanced search with tabs

Before: Search only returned posts.  
After: Search returns **Posts + People** in a tabbed interface.

### How It Works
- Uses existing `useSearchPosts()` hook for post results
- Uses existing `useSearchUsers()` hook for user results (already in API)
- Shows result counts in tab badges
- User results display as cards with avatar, name, username, bio
- Clear button (✕) added to search input
- All existing browse/infinite-scroll behavior preserved

### Architecture
```
User types → debouncedSearch (500ms) → useSearchPosts() + useSearchUsers()
                                           ↓                    ↓
                                      Posts Tab              People Tab
```

---

## FEATURE 4 — SAVED POSTS (NO CHANGES NEEDED)

### Status: ✅ ALREADY WORKING — Not modified

After thorough code review:
- `savePost()` writes to `saves` table with conflict handling
- `deleteSave()` removes from `saves` table
- `getSavedPosts()` fetches with post + creator joins
- Mutation hooks properly invalidate `GET_SAVED_POSTS`
- UI (`PostStats.tsx`) correctly toggles save state
- `Saved.tsx` page properly displays saved posts

**Decision:** Not touched to avoid regressions.

---

## FEATURE 5 — SHARE UX (NO CHANGES NEEDED)

### Status: ✅ ALREADY WORKING — Not modified

After thorough code review:
- `ShareModal.tsx` has clipboard copy with fallback for iOS Safari
- Social sharing: WhatsApp, Twitter, Facebook, LinkedIn, Telegram
- Post preview in modal with creator avatar
- `PostStats.tsx` uses Web Share API on mobile, custom modal on desktop

**Decision:** Not touched to avoid regressions.

---

## FEATURE 6 — SETTINGS PAGE (NEW)

### Status: ✅ NEW — Built from scratch

### Files Created
- **`src/_root/pages/Settings.tsx`** — Full settings page
- **`app/settings/page.tsx`** — Route wrapper

### Sections
1. **Profile Information**
   - Profile image upload (uses existing `ProfileUploader`)
   - Name (editable)
   - Username (read-only, disabled)
   - Email (read-only, disabled)
   - Bio (editable textarea)
   - Privacy setting (Public/Private/Followers Only cards)
   - Save Changes button

2. **Change Password**
   - New password + confirm fields
   - Uses existing `updateUserPassword()` from API
   - Minimum 6 character validation

3. **Account**
   - Logout button (red, danger zone styling)
   - Uses existing `signOutUser()` from API

4. **Legal**
   - Terms/Privacy placeholder text
   - Version indicator

---

## FEATURE 7 — ROUTING & NAVIGATION (FIXED)

### Status: ✅ FIXED

### Changes Made

1. **`src/constants/index.ts`**
   - Added Messages link to `sidebarLinks` (uses `chat.svg`)
   - Added Settings link to `sidebarLinks` (uses new `settings.svg`)
   - Added Messages link to `bottombarLinks` (mobile)

2. **`public/assets/icons/settings.svg`** — New gear icon (created)

3. **`middleware.ts`** — Already correct
   - `/messages` and `/settings` are NOT in `publicRoutes`, so they require auth cookies
   - No changes needed

### Route Map
| Route | Page | Auth Required |
|---|---|---|
| `/messages` | Messages | ✅ Yes |
| `/settings` | Settings | ✅ Yes |
| `/` | Home | ❌ No |
| `/explore` | Explore | ❌ No |
| `/all-users` | People | ❌ No |
| `/saved` | Saved | ✅ Yes |
| `/admin` | Admin | ✅ Yes (+ role check) |

---

## FILES MODIFIED

### New Files
| File | Purpose |
|---|---|
| `phase5b_messaging_migration.sql` | Database migration for DM tables |
| `app/api/messages/conversations/route.ts` | Conversations API |
| `app/api/messages/[conversationId]/route.ts` | Messages API |
| `app/messages/page.tsx` | Messages page route |
| `app/settings/page.tsx` | Settings page route |
| `src/_root/pages/Messages.tsx` | Messages UI component |
| `src/_root/pages/Settings.tsx` | Settings UI component |
| `public/assets/icons/settings.svg` | Gear icon for sidebar |

### Modified Files
| File | Changes |
|---|---|
| `src/lib/supabase/database.types.ts` | Added `conversations` and `messages` table types |
| `src/lib/supabase/api.ts` | Added `getConversations`, `getMessages`, `sendMessage`, `createConversation` |
| `src/lib/react-query/queryKeys.ts` | Added `GET_CONVERSATIONS`, `GET_MESSAGES` |
| `src/lib/react-query/queriesAndMutations.ts` | Added messaging hooks + imports |
| `src/constants/index.ts` | Added Messages + Settings to sidebar/bottombar |
| `app/api/notifications/route.ts` | Added GET + PATCH handlers |
| `src/components/shared/NotificationBell.tsx` | Mark-all-as-read, click-outside |
| `src/_root/pages/Explore.tsx` | Combined user + post search with tabs |

### Untouched (Verified Working)
| File | Reason |
|---|---|
| `src/components/shared/PostStats.tsx` | Save/like/share already working |
| `src/components/shared/ShareModal.tsx` | Share UX already complete |
| `src/_root/pages/Saved.tsx` | Saved posts already persisting |
| `middleware.ts` | Already handles new routes correctly |

---

## VALIDATION RESULTS

```
✅ npm run lint → No ESLint warnings or errors
✅ npm run build → Compiled successfully, 31/31 static pages generated
✅ All API routes compiled (messaging, notifications, admin, verification)
✅ All page routes compiled (messages, settings, explore, saved, etc.)
```

---

## REQUIRED MANUAL STEP

> ⚠️ **You must run `phase5b_messaging_migration.sql` in the Supabase SQL Editor** to create the `conversations` and `messages` tables before DMs will work.

---

## WHAT'S NEXT (Phase 6 Suggestions)

1. Push notifications (Web Push API)
2. Group messaging
3. Message media attachments (images)
4. Typing indicators via Supabase Realtime
5. User blocking/muting
6. Message search
7. Read receipts UI (checkmarks)
