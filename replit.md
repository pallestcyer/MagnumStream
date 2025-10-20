# Flight Recording Platform

## Overview
A dual-camera flight recording platform with a 3-phase workflow (Introduction, Main Tour, Closing). The system supports two camera angles with preview capabilities, export to DaVinci Resolve, and sharing via Google Drive and SMS text links.

## Project Status
**Last Updated:** October 20, 2025

### Completed Features
- ✅ 3-phase recording workflow (Introduction, Main Tour, Closing)
- ✅ Dual-camera preview and recording system
- ✅ Phase skip navigation buttons for testing
- ✅ Visual timeline with draggable trim handles (yellow/gold design)
- ✅ ClipEditor page with frame-accurate editing
- ✅ Flight metadata capture (date/time)
- ✅ Export workflow simulation (DaVinci → Google Drive → SMS)
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
- `/` - RecordingDashboard: Main recording interface with 3-phase workflow
- `/editor` - ClipEditor: Timeline editing with visual trim controls

#### Key Components
- `VideoTrimmer`: Visual timeline with draggable yellow handles for precise trimming
- `CameraPreview`: Dual camera preview with side-by-side layout
- `FlightMetadataDialog`: Capture flight date/time before export
- `ExportWorkflow`: Multi-stage export process (DaVinci → Drive → SMS)
- `PhaseIndicator`: Shows current phase in 3-phase workflow
- `RecordingControls`: Start/stop/pause/retake recording controls

#### Data Model
```typescript
interface Clip {
  id: string;
  title: string;
  duration: number;
  phaseId: number;
  trimStart?: number;
  trimEnd?: number;
  camera1Url?: string;  // Dual camera support
  camera2Url?: string;
}
```

### Design Guidelines
- Dark background with glassmorphism effects (`bg-card/30 backdrop-blur-md`)
- Purple-blue gradient for primary actions (`bg-gradient-purple-blue`)
- Yellow/gold trim handles (#FFD700) for video editing
- Consistent spacing and rounded corners (`rounded-lg`)
- Shadcn UI components for consistency

### Testing Features
- Phase skip buttons (Phase 1/2/3) for quick navigation during testing
- Mock clips in ClipEditor for development/testing

### Future Enhancements
- Real Google Drive upload integration
- Real Twilio SMS integration
- Backend API routes for export processing
- Actual video recording/playback functionality
- Real-time camera feeds from MediaDevices API
