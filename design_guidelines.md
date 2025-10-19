# Video Recording Platform - Design Guidelines

## Design Approach
**System-Based**: Following modern application design principles with strong emphasis on usability and visual feedback, drawing inspiration from professional video editing tools like Loom, Descript, and Adobe Premiere Pro's simplified interfaces.

## Color Palette

### Dark Theme Foundation
- **Background**: Deep dark blue/purple gradient (220 15% 8% to 260 20% 12%)
- **Primary Gradient**: Purple to blue (#667eea to #764ba2)
- **Surface**: Glass-morphic panels with subtle transparency (rgba(255,255,255,0.05))
- **Recording Accent**: Vibrant red (0 84% 60%) for active recording indicators

### UI Elements
- **Text Primary**: 0 0% 95%
- **Text Secondary**: 0 0% 70%
- **Success/Checkmark**: 142 76% 36%
- **Border**: 0 0% 100% at 10% opacity
- **Focus States**: Primary gradient with glow effect

## Typography
- **Primary Font**: Inter or SF Pro Display via Google Fonts
- **Headers**: 600-700 weight, 24-32px for section titles
- **Body**: 400-500 weight, 14-16px for interface text
- **Counters/Timers**: 600 weight, 18-20px, monospace (JetBrains Mono)
- **Form Labels**: 500 weight, 13px, uppercase tracking

## Layout System

### Spacing
- **Core Units**: Use Tailwind spacing of 2, 4, 6, 8, 12, 16, 20, 24 for consistency
- **Section Padding**: p-6 for panels, p-8 for main areas
- **Component Gaps**: gap-4 for tight groupings, gap-6 for section separations

### Grid Structure
- **Left Sidebar**: Fixed 80px width, flex-col with icon navigation
- **Main Content**: Flex-1, divided into recording area (60%) and preview panel (40%)
- **Timeline Area**: Full-width horizontal strip below, 200px height
- **Header**: Fixed 64px height across top

## Component Library

### Navigation Sidebar (80px)
- Vertical icon stack with labels on hover
- Icons: Recording (primary), Settings, Export, Help
- Active state: gradient background + white icon
- Glassmorphic background with backdrop-blur-lg

### Phase Progress Indicator
- **Visual**: Horizontal stepper with 3 nodes
- **Active State**: Gradient-filled circle with glow
- **Complete**: Green checkmark icon
- **Pending**: Outlined circle with phase number
- **Labels**: "Phase 1: Introduction" | "Phase 2: Main Tour" | "Phase 3: Closing"

### Recording Controls
- **Primary Button**: Large gradient button (h-14, min-w-48) "Start Recording"
- **Secondary Controls**: Icon buttons for pause/resume (h-12 w-12, rounded-full)
- **Retake**: Outlined button with subtle hover glow
- **Countdown Overlay**: Full-screen semi-transparent with large 3-2-1 numbers

### Recording Status Indicators
- **Active Recording**: Pulsing red dot (8px) + elapsed timer + "REC" text
- **Audio Levels**: Vertical bar meters (4px width each, gap-1)
- **Storage**: Text with icon showing available space
- **Auto-save**: Subtle pulse animation on save icon

### Timeline Component
- **Clip Cards**: Rounded-lg with thumbnail preview (16:9 aspect)
- **Duration Badge**: Absolute positioned, bottom-right, dark background
- **Trim Handles**: 12px width draggable edges with resize cursor
- **Drag Indicator**: Subtle dotted background pattern when reordering
- **Playhead**: 2px red vertical line with draggable circle handle

### Form Fields (Phase 1)
- **Input Style**: Glassmorphic background, white text, subtle border
- **Height**: h-12 for single-line inputs
- **Focus**: Gradient border with outer glow
- **Labels**: Above input, 500 weight, secondary text color

### Camera/Mic Preview
- **Aspect Ratio**: 16:9 for video preview
- **Border**: 1px gradient border when active recording
- **Dropdowns**: Glassmorphic select menus for device selection
- **Position**: Top-right of recording area, size varies by phase

### Playback Controls
- **Play/Pause**: Large center icon button (h-16 w-16)
- **Scrubber**: Full-width progress bar with hover preview
- **Time Display**: Current / Total duration in monospace font

## Glassmorphism Effects
- **Background**: backdrop-blur-xl with rgba(255,255,255,0.05)
- **Border**: 1px solid rgba(255,255,255,0.1)
- **Shadow**: Subtle multi-layered shadows for depth
- **Applied To**: Sidebar, panels, modals, timeline cards

## Animations
- **Recording Pulse**: 2s infinite pulse on red dot
- **Phase Transitions**: 300ms ease-in-out slide + fade
- **Button Hovers**: 200ms scale(1.02) + brightness increase
- **Countdown**: Scale animation from 1.5 to 1 per number
- **Clip Loading**: Skeleton shimmer effect
- **Trim Adjustments**: Smooth 150ms duration updates

## Status & Feedback
- **Processing**: Linear gradient loading bar under affected clip
- **Success**: Green checkmark with fade-in + scale animation
- **Error States**: Red border + shake animation + error text
- **Keyboard Shortcuts**: Toast notification on first use, dismissable

## Keyboard Shortcuts Display
- **Position**: Bottom-right corner, collapsible panel
- **Style**: Small glassmorphic card listing shortcuts
- **Format**: Key badge (monospace) + description
- **Toggle**: "?" key or info icon

## Export Panel
- **Quality Settings**: Radio buttons for 1080p/720p/480p
- **Format**: Dropdown for MP4/WebM/MOV
- **Button**: Large gradient "Export Video" button
- **Progress**: Linear gradient bar with percentage

This design creates a professional, intuitive recording experience with visual depth through glassmorphism, clear phase progression, and powerful yet accessible editing controls.