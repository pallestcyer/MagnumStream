# Flight Recording Platform

## Overview
A dual-camera flight recording platform with an **8-slot template system**. The workflow consists of: (1) Info page with name/email and live camera preview, (2) Record 3 scenes (Cruising, Chase, Arrival) with 2 camera angles each (minimum 30 seconds per scene), (3) Edit using 8 fixed slots across 3 separate sub-pages where recordings are injected (Scene 1: 3 slots, Scene 2: 3 slots, Scene 3: 2 slots), each slot limited to 3 seconds with interactive card selection and window adjustment, (4) Dual preview showing edited video + background template, (5) Export to DaVinci, upload to Google Drive, and send SMS links. Phase navigation tabs (Info → Recording → Editing → Export) enable jumping between workflow stages.

## Project Status
**Last Updated:** October 20, 2025

### Completed Features
- ✅ **Sidebar navigation** with Home, History, Manual, Chat, and Issue Reporting
- ✅ 8-slot template system with fixed camera angle mapping
- ✅ 3-scene recording workflow (Cruising, Chase, Arrival)
- ✅ Info page with **3 fields**: pilot name, email, and staff member dropdown
- ✅ Live dual-camera preview on info page
- ✅ Dual-camera recording for each scene
- ✅ **30-second minimum recording duration** requirement per scene with validation
- ✅ **3 separate editor sub-pages** (one for each scene) for easier viewing
- ✅ **Interactive slot card selection** - click to activate, plays 3-second preview while adjusting
- ✅ Window picker (not trim) - select which 3-second chunk from recording
- ✅ **Dual preview system** - left shows 3-second clip preview, right shows background template/slot context
- ✅ **Phase navigation tabs** (Info → Recording → Editing → Export)
- ✅ **PilotContext** for sharing pilot info and staff member across all pages
- ✅ **Auto-rounding flight time** to next hour or half-hour by default
- ✅ Flight metadata capture (date/time)
- ✅ Export workflow simulation (DaVinci → Google Drive → SMS)
- ✅ **History page** showing past recordings and exports
- ✅ **Manual page** with complete staff instructions
- ✅ **AI Chat page** for asking questions about the system
- ✅ **Issue reporting page** for submitting errors and problems
- ✅ Dark theme with glassmorphism effects
- ✅ Purple/blue gradient design (#667eea to #764ba2)

### Current Implementation
- **Frontend:** React with TypeScript, Wouter routing, Shadcn UI components
- **Storage:** In-memory storage (MemStorage) - no database required
- **Design:** Dark theme with glassmorphism, inspired by Loom/Descript/Adobe Premiere
- **No Audio:** Microphone and audio controls removed per requirements

### Integrations Status

#### Google Drive Integration
**Status:** User dismissed connector integration  
**Note:** The Google Drive connector (`connector:ccfg_google-drive_0F6D7EF5E22543468DB221F94F`) was proposed but dismissed by the user. Currently using simulated upload functionality in the export workflow.

**To enable real Google Drive uploads:**
1. Set up the Google Drive connector integration, OR
2. Provide Google Drive API credentials as secrets:
   - `GOOGLE_DRIVE_CLIENT_ID`
   - `GOOGLE_DRIVE_CLIENT_SECRET`
   - `GOOGLE_DRIVE_REFRESH_TOKEN`

#### Twilio SMS Integration
**Status:** User dismissed connector integration  
**Note:** The Twilio connector (`connector:ccfg_twilio_01K69QJTED9YTJFE2SJ7E4SY08`) was proposed but dismissed by the user. Currently using simulated SMS functionality in the export workflow.

**To enable real SMS sending:**
1. Set up the Twilio connector integration, OR
2. Provide Twilio API credentials as secrets:
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_AUTH_TOKEN`
   - `TWILIO_PHONE_NUMBER`

### Architecture

#### Pages
- `/` - InfoPage (Home): Pilot name, email, staff member dropdown with live dual-camera preview
- `/recording` - RecordingDashboard: Main recording interface with 3 scenes (minimum 30s each)
- `/editor/cruising` - EditorCruising: Edit slots 1-3 for Cruising scene with interactive preview
- `/editor/chase` - EditorChase: Edit slots 4-6 for Chase scene with interactive preview
- `/editor/arrival` - EditorArrival: Edit slots 7-8 for Arrival scene with interactive preview + export
- `/history` - HistoryPage: View past recordings, exports, and metadata
- `/manual` - ManualPage: Complete staff instructions and best practices
- `/chat` - ChatPage: AI assistant for asking questions about the platform
- `/issues` - IssuesPage: Submit error reports and technical issues

#### Key Components
- `AppSidebar`: Left sidebar navigation (Home, History, Manual, Chat, Issues)
- `SlotSelector`: Color-coded 3-second window picker with timeline visualization
- `CameraPreview`: Dual camera preview with side-by-side layout
- `FlightMetadataDialog`: Capture flight date/time before export (auto-rounds to next hour/half-hour)
- `ExportWorkflow`: Multi-stage export process (DaVinci → Drive → SMS)
- `PhaseNavigation`: Tab-based navigation between workflow phases (Info → Recording → Editing → Export)
- `PilotContext`: React context for sharing pilot info and staff member across all pages

#### 8-Slot Template System
The template consists of 8 fixed slots, each locked to a specific scene and camera angle:

**Scene 1 (Cruising):**
- Slot 1: Camera 1 (3s max) - Blue
- Slot 2: Camera 2 (3s max) - Cyan  
- Slot 3: Camera 1 (3s max) - Teal

**Scene 2 (Chase):**
- Slot 4: Camera 1 (3s max) - Purple
- Slot 5: Camera 2 (3s max) - Magenta
- Slot 6: Camera 1 (3s max) - Pink

**Scene 3 (Arrival):**
- Slot 7: Camera 1 (3s max) - Green
- Slot 8: Camera 2 (3s max) - Lime

#### Data Model
```typescript
interface SlotConfig {
  slotNumber: number;
  sceneType: 'cruising' | 'chase' | 'arrival';
  cameraAngle: 1 | 2;
  color: string;
  maxDuration: 3;
}

interface PilotInfo {
  name: string;
  email: string;
  staffMember: string;
}

interface Recording {
  id: string;
  pilotName: string;
  email: string;
  staffMember: string;
  scenes: SceneRecording[];
  slotSelections: SlotSelection[];
}

interface SlotSelection {
  slotNumber: number;
  windowStart: number; // Start time of 3-second window in source recording
}
```

### Design Guidelines
- Dark background with glassmorphism effects (`bg-card/30 backdrop-blur-md`)
- Purple-blue gradient for primary actions (`bg-gradient-purple-blue`)
- Yellow/gold trim handles (#FFD700) for video editing
- Consistent spacing and rounded corners (`rounded-lg`)
- Shadcn UI components for consistency

### Workflow
1. **Info Page (Home):** Staff enters pilot name, email, and selects staff member from dropdown. Confirms camera setup with live dual-camera preview.
2. **Recording:** Record 3 scenes (Cruising, Chase, Arrival) with 2 camera angles each (minimum 30 seconds per scene)
3. **Editing (3 sub-pages):**
   - **Cruising Editor:** Click slots 1-3 to activate, select 3-second windows with live preview
   - **Chase Editor:** Click slots 4-6 to activate, select 3-second windows with live preview
   - **Arrival Editor:** Click slots 7-8 to activate, select 3-second windows with live preview
4. **Export:** Add flight metadata (auto-rounded time), export to DaVinci, upload to Drive, send SMS
5. **History:** Review past recordings and access export links
6. **Manual:** Staff can reference complete instructions and best practices
7. **Chat:** Ask AI assistant questions about using the platform
8. **Issues:** Submit error reports and technical problems

### Testing Features
- Scene skip buttons for quick navigation during testing
- Mock scene data in SlotEditor for development/testing
- Placeholder export functionality until real integrations are added

### Future Enhancements
- Real Google Drive upload integration
- Real Twilio SMS integration
- Backend API routes for export processing and storage
- Actual video recording/playback with MediaRecorder API
- Real-time dual camera feeds from MediaDevices API
- Video composition and rendering for export
