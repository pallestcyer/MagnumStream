# Scene Editor Implementation Guide

## Overview
Complete implementation guide for the MagnumStream scene editor that handles 30-second recordings broken into 3-5 second segments with real-time preview and automatic camera targeting.

## Architecture

### Component Structure
```
SceneEditor/
├── MasterTimeline (30s full scene view)
├── SegmentEditor (individual segment controls)  
├── CameraPreview (dual camera sources)
├── LivePreview (real-time result video)
└── ExportWorkflow (existing integration)
```

### Database Schema Updates

#### New Tables

**scene_segments**
```typescript
export const sceneSegments = pgTable("scene_segments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sceneId: varchar("scene_id").notNull().references(() => sceneRecordings.id, { onDelete: "cascade" }),
  segmentNumber: integer("segment_number").notNull(),
  startTime: real("start_time").notNull(), // Start time in scene (0-30s)
  duration: real("duration").notNull(),    // 3s, 5s, or custom
  cameraAngle: integer("camera_angle").notNull(), // 1 or 2
  color: text("color").notNull().default("#FF6B35"), // Visual indicator
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
```

#### Updated Tables

**sceneRecordings** (add camera source tracking)
```typescript
// Add these fields to existing sceneRecordings table
camera1Source: text("camera1_source").default("front"), // Auto-set device
camera2Source: text("camera2_source").default("rear"),  // Auto-set device
```

**videoSlots** (support variable durations)
```typescript
// Update slotDuration to be more flexible
slotDuration: real("slot_duration").notNull(), // Remove default(3), allow variable
```

### Core Components

## 1. SceneEditor Component

```typescript
// /client/src/pages/SceneEditor.tsx
import { useState, useEffect } from "react";
import { useParams } from "wouter";
import MasterTimeline from "@/components/MasterTimeline";
import SegmentEditor from "@/components/SegmentEditor";
import CameraPreview from "@/components/CameraPreview";
import LivePreview from "@/components/LivePreview";

interface SceneSegment {
  id: string;
  segmentNumber: number;
  startTime: number;
  duration: number;
  cameraAngle: 1 | 2;
  color: string;
}

export default function SceneEditor() {
  const { sceneId } = useParams();
  const [scene, setScene] = useState(null);
  const [segments, setSegments] = useState<SceneSegment[]>([]);
  const [selectedSegment, setSelectedSegment] = useState<string | null>(null);
  const [previewTime, setPreviewTime] = useState(0);

  // Auto-initialize camera sources on load
  useEffect(() => {
    initializeSceneEditor(sceneId);
  }, [sceneId]);

  const initializeSceneEditor = async (sceneId: string) => {
    const sceneData = await fetchScene(sceneId);
    
    // Auto-set camera sources if not configured
    if (!sceneData.camera1Source) {
      sceneData.camera1Source = "front";
      sceneData.camera2Source = "rear";
      await updateScene(sceneId, sceneData);
    }
    
    setScene(sceneData);
    
    // Load existing segments or create default
    const existingSegments = await fetchSceneSegments(sceneId);
    if (existingSegments.length === 0) {
      const defaultSegments = createDefaultSegments(sceneId);
      await saveSegments(defaultSegments);
      setSegments(defaultSegments);
    } else {
      setSegments(existingSegments);
    }
  };

  const createDefaultSegments = (sceneId: string): SceneSegment[] => [
    {
      id: crypto.randomUUID(),
      segmentNumber: 1,
      startTime: 0,
      duration: 5,
      cameraAngle: 1,
      color: "#FF6B35"
    },
    {
      id: crypto.randomUUID(), 
      segmentNumber: 2,
      startTime: 5,
      duration: 3,
      cameraAngle: 2,
      color: "#F7931E"
    },
    // ... more default segments
  ];

  const handleSegmentChange = (segmentId: string, changes: Partial<SceneSegment>) => {
    setSegments(prev => prev.map(seg => 
      seg.id === segmentId ? { ...seg, ...changes } : seg
    ));
  };

  const handleAddSegment = () => {
    const lastSegment = segments[segments.length - 1];
    const startTime = lastSegment ? lastSegment.startTime + lastSegment.duration : 0;
    
    if (startTime < 30) { // Ensure within 30s limit
      const newSegment: SceneSegment = {
        id: crypto.randomUUID(),
        segmentNumber: segments.length + 1,
        startTime,
        duration: Math.min(3, 30 - startTime),
        cameraAngle: 1,
        color: getNextColor(segments.length)
      };
      
      setSegments([...segments, newSegment]);
    }
  };

  const handleDeleteSegment = (segmentId: string) => {
    setSegments(prev => prev.filter(seg => seg.id !== segmentId));
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold">Scene Editor</h1>
            <div className="flex gap-3">
              <Button onClick={handleAddSegment}>Add Segment</Button>
              <Button className="bg-gradient-purple-blue">Export Scene</Button>
            </div>
          </div>

          {/* Three-panel layout */}
          <div className="grid grid-cols-3 gap-6 h-[600px]">
            {/* Left: Source Videos */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Source Videos</h3>
              <CameraPreview
                hasVideo={true}
                camera1Url={scene?.camera1Url}
                camera2Url={scene?.camera2Url}
              />
            </div>

            {/* Center: Timeline Editor */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Timeline Editor</h3>
              <MasterTimeline
                duration={scene?.duration || 30}
                segments={segments}
                selectedSegment={selectedSegment}
                onSegmentSelect={setSelectedSegment}
                onSegmentChange={handleSegmentChange}
                onSegmentDelete={handleDeleteSegment}
                previewTime={previewTime}
              />
              
              {selectedSegment && (
                <SegmentEditor
                  segment={segments.find(s => s.id === selectedSegment)}
                  onSegmentChange={(changes) => handleSegmentChange(selectedSegment, changes)}
                />
              )}
            </div>

            {/* Right: Live Preview */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Live Preview</h3>
              <LivePreview
                segments={segments}
                camera1Url={scene?.camera1Url}
                camera2Url={scene?.camera2Url}
                previewTime={previewTime}
                onTimeUpdate={setPreviewTime}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
```

## 2. MasterTimeline Component

```typescript
// /client/src/components/MasterTimeline.tsx
import { useState, useRef, useEffect } from "react";
import { Trash2 } from "lucide-react";

interface MasterTimelineProps {
  duration: number; // 30 seconds
  segments: SceneSegment[];
  selectedSegment: string | null;
  onSegmentSelect: (id: string) => void;
  onSegmentChange: (id: string, changes: Partial<SceneSegment>) => void;
  onSegmentDelete: (id: string) => void;
  previewTime: number;
}

export default function MasterTimeline({
  duration,
  segments,
  selectedSegment,
  onSegmentSelect,
  onSegmentChange,
  onSegmentDelete,
  previewTime
}: MasterTimelineProps) {
  const timelineRef = useRef<HTMLDivElement>(null);
  const [dragState, setDragState] = useState<{
    segmentId: string;
    type: 'move' | 'resize-start' | 'resize-end';
    startX: number;
    originalStartTime: number;
    originalDuration: number;
  } | null>(null);

  const getTimeFromX = (x: number): number => {
    if (!timelineRef.current) return 0;
    const rect = timelineRef.current.getBoundingClientRect();
    const percentage = Math.max(0, Math.min(1, x / rect.width));
    return percentage * duration;
  };

  const getXFromTime = (time: number): number => {
    return (time / duration) * 100;
  };

  const handleMouseDown = (
    e: React.MouseEvent,
    segmentId: string,
    type: 'move' | 'resize-start' | 'resize-end'
  ) => {
    e.preventDefault();
    const segment = segments.find(s => s.id === segmentId);
    if (!segment) return;

    setDragState({
      segmentId,
      type,
      startX: e.clientX,
      originalStartTime: segment.startTime,
      originalDuration: segment.duration
    });

    onSegmentSelect(segmentId);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragState || !timelineRef.current) return;

      const deltaX = e.clientX - dragState.startX;
      const deltaTime = (deltaX / timelineRef.current.clientWidth) * duration;

      const segment = segments.find(s => s.id === dragState.segmentId);
      if (!segment) return;

      switch (dragState.type) {
        case 'move': {
          const newStartTime = Math.max(0, 
            Math.min(duration - segment.duration, 
              dragState.originalStartTime + deltaTime
            )
          );
          onSegmentChange(dragState.segmentId, { startTime: newStartTime });
          break;
        }
        case 'resize-start': {
          const newStartTime = Math.max(0, dragState.originalStartTime + deltaTime);
          const newDuration = Math.max(0.5, 
            dragState.originalDuration - deltaTime
          );
          if (newStartTime + newDuration <= duration) {
            onSegmentChange(dragState.segmentId, { 
              startTime: newStartTime, 
              duration: newDuration 
            });
          }
          break;
        }
        case 'resize-end': {
          const newDuration = Math.max(0.5, 
            Math.min(duration - dragState.originalStartTime,
              dragState.originalDuration + deltaTime
            )
          );
          onSegmentChange(dragState.segmentId, { duration: newDuration });
          break;
        }
      }
    };

    const handleMouseUp = () => {
      setDragState(null);
    };

    if (dragState) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, segments, duration, onSegmentChange]);

  const formatTime = (seconds: number) => {
    return `${seconds.toFixed(1)}s`;
  };

  return (
    <div className="space-y-4">
      {/* Timeline ruler */}
      <div className="relative h-8 bg-gray-100 rounded">
        {/* Time markers */}
        {Array.from({ length: 7 }, (_, i) => i * 5).map(time => (
          <div
            key={time}
            className="absolute top-0 h-full flex items-center"
            style={{ left: `${getXFromTime(time)}%` }}
          >
            <div className="w-px h-full bg-gray-400" />
            <span className="absolute top-0 -translate-x-1/2 text-xs text-gray-600">
              {formatTime(time)}
            </span>
          </div>
        ))}
      </div>

      {/* Main timeline */}
      <div
        ref={timelineRef}
        className="relative h-20 bg-black/10 rounded-lg overflow-hidden"
      >
        {/* Preview time indicator */}
        <div
          className="absolute top-0 w-0.5 h-full bg-red-500 z-20"
          style={{ left: `${getXFromTime(previewTime)}%` }}
        />

        {/* Segments */}
        {segments.map(segment => (
          <div
            key={segment.id}
            className={`absolute top-2 h-16 rounded border-2 cursor-move ${
              selectedSegment === segment.id
                ? 'border-primary shadow-lg'
                : 'border-gray-300'
            }`}
            style={{
              left: `${getXFromTime(segment.startTime)}%`,
              width: `${(segment.duration / duration) * 100}%`,
              backgroundColor: `${segment.color}40`,
              borderColor: segment.color
            }}
            onMouseDown={e => handleMouseDown(e, segment.id, 'move')}
          >
            {/* Resize handles */}
            <div
              className="absolute left-0 top-0 w-2 h-full bg-current cursor-ew-resize"
              onMouseDown={e => {
                e.stopPropagation();
                handleMouseDown(e, segment.id, 'resize-start');
              }}
            />
            <div
              className="absolute right-0 top-0 w-2 h-full bg-current cursor-ew-resize"
              onMouseDown={e => {
                e.stopPropagation();
                handleMouseDown(e, segment.id, 'resize-end');
              }}
            />

            {/* Segment content */}
            <div className="flex items-center justify-between h-full px-3">
              <div className="text-xs font-medium">
                Seg {segment.segmentNumber}
                <br />
                Cam {segment.cameraAngle}
              </div>
              <button
                className="p-1 hover:bg-red-500/20 rounded"
                onClick={e => {
                  e.stopPropagation();
                  onSegmentDelete(segment.id);
                }}
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Segment list */}
      <div className="space-y-2">
        {segments.map(segment => (
          <div
            key={segment.id}
            className={`p-3 rounded border cursor-pointer ${
              selectedSegment === segment.id
                ? 'border-primary bg-primary/5'
                : 'border-gray-200'
            }`}
            onClick={() => onSegmentSelect(segment.id)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className="w-4 h-4 rounded"
                  style={{ backgroundColor: segment.color }}
                />
                <span className="font-medium">Segment {segment.segmentNumber}</span>
              </div>
              <div className="text-sm text-gray-600">
                {formatTime(segment.startTime)} - {formatTime(segment.startTime + segment.duration)} 
                (Camera {segment.cameraAngle})
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

## 3. LivePreview Component

```typescript
// /client/src/components/LivePreview.tsx
import { useState, useEffect, useRef } from "react";
import { Play, Pause, SkipBack, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

interface LivePreviewProps {
  segments: SceneSegment[];
  camera1Url?: string;
  camera2Url?: string;
  previewTime: number;
  onTimeUpdate: (time: number) => void;
}

export default function LivePreview({
  segments,
  camera1Url,
  camera2Url,
  previewTime,
  onTimeUpdate
}: LivePreviewProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const camera1VideoRef = useRef<HTMLVideoElement>(null);
  const camera2VideoRef = useRef<HTMLVideoElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Calculate current segment and video source
  const currentSegment = segments.find(segment => 
    previewTime >= segment.startTime && 
    previewTime < (segment.startTime + segment.duration)
  );

  const currentVideoUrl = currentSegment?.cameraAngle === 1 ? camera1Url : camera2Url;
  const currentVideoRef = currentSegment?.cameraAngle === 1 ? camera1VideoRef : camera2VideoRef;

  // Calculate total duration
  const totalDuration = Math.max(...segments.map(s => s.startTime + s.duration), 30);

  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = setInterval(() => {
        onTimeUpdate(prev => {
          const newTime = prev + 0.1;
          return newTime >= totalDuration ? 0 : newTime;
        });
      }, 100);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isPlaying, totalDuration, onTimeUpdate]);

  // Sync video element with preview time
  useEffect(() => {
    if (currentVideoRef?.current && currentSegment) {
      const videoTime = previewTime - currentSegment.startTime;
      currentVideoRef.current.currentTime = Math.max(0, videoTime);
    }
  }, [previewTime, currentSegment, currentVideoRef]);

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handleTimeChange = (value: number[]) => {
    onTimeUpdate(value[0]);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(1);
    return `${mins}:${secs.padStart(4, '0')}`;
  };

  return (
    <div className="space-y-4">
      {/* Video preview */}
      <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
        {/* Camera 1 video (hidden when not active) */}
        <video
          ref={camera1VideoRef}
          src={camera1Url}
          className={`absolute inset-0 w-full h-full object-cover ${
            currentSegment?.cameraAngle === 1 ? 'opacity-100' : 'opacity-0'
          }`}
          muted
          preload="metadata"
        />
        
        {/* Camera 2 video (hidden when not active) */}
        <video
          ref={camera2VideoRef}
          src={camera2Url}
          className={`absolute inset-0 w-full h-full object-cover ${
            currentSegment?.cameraAngle === 2 ? 'opacity-100' : 'opacity-0'
          }`}
          muted
          preload="metadata"
        />

        {/* Overlay information */}
        <div className="absolute top-4 left-4 bg-black/70 text-white px-3 py-1 rounded">
          {currentSegment ? (
            <div className="text-sm">
              Segment {currentSegment.segmentNumber} • Camera {currentSegment.cameraAngle}
            </div>
          ) : (
            <div className="text-sm">No segment</div>
          )}
        </div>

        {/* Segment timeline overlay */}
        <div className="absolute bottom-4 left-4 right-4">
          <div className="bg-black/70 rounded p-2">
            <div className="relative h-2 bg-gray-600 rounded">
              {segments.map(segment => (
                <div
                  key={segment.id}
                  className="absolute h-full rounded"
                  style={{
                    left: `${(segment.startTime / totalDuration) * 100}%`,
                    width: `${(segment.duration / totalDuration) * 100}%`,
                    backgroundColor: segment.color
                  }}
                />
              ))}
              {/* Current time indicator */}
              <div
                className="absolute top-0 w-0.5 h-full bg-white"
                style={{ left: `${(previewTime / totalDuration) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Playback controls */}
      <div className="bg-card/30 backdrop-blur-md rounded-lg border p-4 space-y-4">
        <div className="flex items-center justify-center gap-4">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => onTimeUpdate(Math.max(0, previewTime - 5))}
          >
            <SkipBack className="w-5 h-5" />
          </Button>

          <Button
            size="icon"
            variant="default"
            className="w-12 h-12 bg-gradient-purple-blue"
            onClick={handlePlayPause}
          >
            {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
          </Button>

          <Button
            size="icon"
            variant="ghost"
            onClick={() => onTimeUpdate(Math.min(totalDuration, previewTime + 5))}
          >
            <SkipForward className="w-5 h-5" />
          </Button>
        </div>

        <div className="space-y-2">
          <Slider
            value={[previewTime]}
            onValueChange={handleTimeChange}
            max={totalDuration}
            step={0.1}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground font-mono">
            <span>{formatTime(previewTime)}</span>
            <span>{formatTime(totalDuration)}</span>
          </div>
        </div>
      </div>

      {/* Segment info */}
      <div className="bg-card/30 backdrop-blur-md rounded-lg border p-4">
        <h4 className="font-semibold mb-2">Current Segment</h4>
        {currentSegment ? (
          <div className="space-y-1 text-sm">
            <div>Segment {currentSegment.segmentNumber}</div>
            <div>Camera {currentSegment.cameraAngle}</div>
            <div>Duration: {currentSegment.duration.toFixed(1)}s</div>
            <div>Time: {formatTime(currentSegment.startTime)} - {formatTime(currentSegment.startTime + currentSegment.duration)}</div>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">No active segment</div>
        )}
      </div>
    </div>
  );
}
```

## 4. SegmentEditor Component

```typescript
// /client/src/components/SegmentEditor.tsx
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Camera1, Camera2 } from "lucide-react";

interface SegmentEditorProps {
  segment: SceneSegment | undefined;
  onSegmentChange: (changes: Partial<SceneSegment>) => void;
}

export default function SegmentEditor({ segment, onSegmentChange }: SegmentEditorProps) {
  if (!segment) {
    return (
      <div className="p-4 border rounded-lg text-center text-muted-foreground">
        Select a segment to edit
      </div>
    );
  }

  const handleStartTimeChange = (value: number[]) => {
    onSegmentChange({ startTime: value[0] });
  };

  const handleDurationChange = (value: number[]) => {
    onSegmentChange({ duration: value[0] });
  };

  const handleCameraChange = (camera: 1 | 2) => {
    onSegmentChange({ cameraAngle: camera });
  };

  const handleColorChange = (color: string) => {
    onSegmentChange({ color });
  };

  const colorPresets = [
    "#FF6B35", "#F7931E", "#FF8C42", "#FFA500",
    "#FF9E3D", "#FFB84D", "#FF7A3D", "#FFAB5E"
  ];

  return (
    <div className="p-4 border rounded-lg space-y-4">
      <div className="flex items-center gap-3">
        <div
          className="w-6 h-6 rounded"
          style={{ backgroundColor: segment.color }}
        />
        <h3 className="font-semibold">Segment {segment.segmentNumber}</h3>
      </div>

      {/* Start Time */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Start Time: {segment.startTime.toFixed(1)}s</label>
        <Slider
          value={[segment.startTime]}
          onValueChange={handleStartTimeChange}
          max={29}
          step={0.1}
          className="w-full"
        />
      </div>

      {/* Duration */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Duration: {segment.duration.toFixed(1)}s</label>
        <Slider
          value={[segment.duration]}
          onValueChange={handleDurationChange}
          min={0.5}
          max={10}
          step={0.1}
          className="w-full"
        />
      </div>

      {/* Camera Selection */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Camera Angle</label>
        <div className="flex gap-2">
          <Button
            variant={segment.cameraAngle === 1 ? "default" : "outline"}
            size="sm"
            onClick={() => handleCameraChange(1)}
            className="flex-1"
          >
            <Camera1 className="w-4 h-4 mr-2" />
            Camera 1
          </Button>
          <Button
            variant={segment.cameraAngle === 2 ? "default" : "outline"}
            size="sm"
            onClick={() => handleCameraChange(2)}
            className="flex-1"
          >
            <Camera2 className="w-4 h-4 mr-2" />
            Camera 2
          </Button>
        </div>
      </div>

      {/* Color Selection */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Color</label>
        <div className="grid grid-cols-4 gap-2">
          {colorPresets.map(color => (
            <button
              key={color}
              className={`w-8 h-8 rounded border-2 ${
                segment.color === color ? 'border-primary' : 'border-gray-300'
              }`}
              style={{ backgroundColor: color }}
              onClick={() => handleColorChange(color)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
```

## Integration with Existing Workflow

### 1. Route Setup
```typescript
// Add to App.tsx routing
<Route path="/scene-editor/:sceneId" component={SceneEditor} />
```

### 2. Navigation from SlotEditor
```typescript
// In SlotEditor.tsx, add scene editing button
<Button 
  onClick={() => setLocation(`/scene-editor/${scene.id}`)}
  variant="outline"
>
  Edit Scene Segments
</Button>
```

### 3. API Integration
```typescript
// /server/routes.ts - Add scene segment endpoints
app.get("/api/scenes/:id/segments", async (req, res) => {
  const segments = await db.select().from(sceneSegments)
    .where(eq(sceneSegments.sceneId, req.params.id));
  res.json(segments);
});

app.post("/api/scenes/:id/segments", async (req, res) => {
  const segment = await db.insert(sceneSegments)
    .values({ ...req.body, sceneId: req.params.id })
    .returning();
  res.json(segment[0]);
});

app.put("/api/segments/:id", async (req, res) => {
  const segment = await db.update(sceneSegments)
    .set(req.body)
    .where(eq(sceneSegments.id, req.params.id))
    .returning();
  res.json(segment[0]);
});

app.delete("/api/segments/:id", async (req, res) => {
  await db.delete(sceneSegments)
    .where(eq(sceneSegments.id, req.params.id));
  res.json({ success: true });
});
```

## Testing Considerations

### Unit Tests
- Segment drag and resize functionality
- Camera switching logic
- Timeline calculations
- Preview synchronization

### Integration Tests  
- Full scene editing workflow
- Auto camera source detection
- Export integration
- Database persistence

## Performance Optimizations

### Video Handling
- Preload both camera videos
- Use video sprites for timeline thumbnails
- Implement smooth transitions between camera angles
- Cache video metadata

### UI Responsiveness
- Debounce drag operations
- Virtualize long segment lists
- Optimize re-renders with React.memo
- Use requestAnimationFrame for smooth playback

## Future Enhancements

### Advanced Features
- Keyframe-based transitions
- Audio waveform visualization
- Automatic scene detection
- AI-powered optimal segment suggestions
- Multi-track editing support

### Export Options
- Multiple resolution outputs
- Custom segment ordering
- Transition effects
- Watermark support