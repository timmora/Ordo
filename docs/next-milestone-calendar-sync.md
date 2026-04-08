# Next Milestone Scope: Calendar Sync

## Chosen Strategic Bet
Implement one-way calendar sync (Google first, Outlook second) so external events appear in Ordo and can be considered by scheduling logic.

## Why This Choice
- Highest user-facing value among large features.
- Reduces duplicate entry friction immediately.
- Creates a foundation for two-way sync later.

## Scope (Phase 1)
- OAuth connect/disconnect flow in settings.
- Pull external events on connect and periodic refresh.
- Render external events read-only in `CalendarView`.
- Exclude external busy blocks from scheduler placement.
- Conflict-safe behavior: Ordo never edits external calendars in phase 1.

## Out of Scope
- Two-way writes/edits.
- Multi-account merge rules.
- Shared team calendars.

## Technical Plan
- **Backend**
  - Add provider credentials + token storage (encrypted).
  - Add sync endpoints and background refresh worker.
  - Normalize provider events into a single external-events table.
- **Frontend**
  - Add calendar integration card in `SettingsModal`.
  - Show connection status + last sync timestamp.
  - Surface external events with provider badge in `CalendarView`.
- **Scheduler**
  - Treat synced events as hard busy windows.

## Acceptance Criteria
- User can connect Google and see imported events within 60 seconds.
- Imported events are visible in calendar and blocked for auto-scheduling.
- Disconnect immediately removes external events from active views.
