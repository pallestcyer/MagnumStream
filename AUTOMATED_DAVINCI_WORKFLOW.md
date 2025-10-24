# Automated DaVinci Resolve Integration Workflow

## Overview
Complete automation from scene editor to final rendered video without manual DaVinci interaction.

## Workflow Architecture

```
Scene Editor (Web App) → FFmpeg Processing → DaVinci Automation → Final Video
```

## Part 1: Scene Editor to Clip Generation

### 1.1 Scene Editor Output Processing
Your scene editor creates segments like this:
```typescript
// From your scene segments table
const segments = [
  {
    sceneType: "chase",
    segmentNumber: 1,
    startTime: 0,      // Start in scene (0-30s)
    duration: 5,       // 5 second segment
    cameraAngle: 1
  },
  {
    sceneType: "chase", 
    segmentNumber: 2,
    startTime: 5,      // Next segment starts at 5s
    duration: 3,       // 3 second segment
    cameraAngle: 2
  }
  // ... more segments
];
```

### 1.2 FFmpeg Clip Generation Service
```typescript
// Enhanced server/services/ClipProcessor.ts
export class AutomatedClipProcessor {
  
  async processSceneForDaVinci(recordingId: string): Promise<string> {
    // 1. Get scene segments from database
    const segments = await this.getSceneSegments(recordingId);
    
    // 2. Generate clips using FFmpeg
    const clipFiles = await this.generateClipsFromSegments(segments);
    
    // 3. Create DaVinci job file
    const jobFilePath = await this.createDaVinciJob(recordingId, clipFiles);
    
    return jobFilePath;
  }

  private async generateClipsFromSegments(segments: SceneSegment[]): Promise<ClipFile[]> {
    const clipFiles: ClipFile[] = [];
    
    for (const segment of segments) {
      // Get source scene recording
      const sourceVideo = await this.getSourceVideo(segment.sceneId);
      
      // Generate output filename based on DaVinci slot mapping
      const outputFile = `slot_${segment.segmentNumber}_${segment.sceneType}.mp4`;
      
      // FFmpeg command for precise cutting
      const command = [
        'ffmpeg', '-y',
        '-i', sourceVideo.filePath,
        '-ss', segment.startTime.toString(),
        '-t', segment.duration.toString(),
        '-c', 'copy', // No re-encoding for speed
        `./clips/${outputFile}`
      ].join(' ');
      
      await this.executeFFmpeg(command);
      
      clipFiles.push({
        slotNumber: segment.segmentNumber,
        filePath: `./clips/${outputFile}`,
        originalSegment: segment
      });
    }
    
    return clipFiles;
  }
}
```

## Part 2: DaVinci Job Creation

### 2.1 Generate DaVinci Job File
```typescript
// Create job file that DaVinci automation will process
private async createDaVinciJob(recordingId: string, clipFiles: ClipFile[]): Promise<string> {
  const jobData = {
    jobId: crypto.randomUUID(),
    recordingId,
    projectName: `Flight_${recordingId}_${Date.now()}`,
    templateProject: "MagnumPI_Template", // Your DaVinci template
    clips: {},
    renderSettings: {
      outputPath: `./renders/`,
      format: "mp4",
      quality: "high"
    }
  };
  
  // Map clips to DaVinci slot positions (from your clip_positions.json)
  const slotMapping = await this.getSlotMapping(); // From your Lua script output
  
  clipFiles.forEach((clipFile, index) => {
    const slotData = slotMapping.clips[index];
    
    jobData.clips[slotData.slot] = {
      filename: path.basename(clipFile.filePath),
      fullPath: clipFile.filePath,
      startFrame: slotData.start_frame,
      durationFrames: Math.round(clipFile.originalSegment.duration * 23.976), // Your frame rate
      replaceExisting: true
    };
  });
  
  // Write job file for DaVinci watcher
  const jobFilePath = `./davinci_queue/job_${recordingId}.json`;
  await fs.writeFile(jobFilePath, JSON.stringify(jobData, null, 2));
  
  return jobFilePath;
}
```

## Part 3: DaVinci Automation Script (Lua-based)

### 3.1 Lua Automation Script (Runs in DaVinci)
```lua
-- davinci_auto_processor.lua
-- Place this script to run automatically in DaVinci or via watch folder

local json = require("json") -- You might need a Lua JSON library

function processJobFile(jobFilePath)
    local file = io.open(jobFilePath, "r")
    if not file then return false end
    
    local jobDataStr = file:read("*all")
    file:close()
    
    local jobData = json.decode(jobDataStr)
    
    -- Get DaVinci objects
    local resolve = Resolve()
    local projectManager = resolve:GetProjectManager()
    
    -- Load template project
    local project = projectManager:LoadProject(jobData.templateProject)
    if not project then
        print("Error: Could not load template project")
        return false
    end
    
    local timeline = project:GetCurrentTimeline()
    if not timeline then
        print("Error: No timeline in template")
        return false
    end
    
    -- Import new clips to media pool
    local mediaPool = project:GetMediaPool()
    local importedClips = {}
    
    for slotNum, clipData in pairs(jobData.clips) do
        local importResult = mediaPool:ImportMedia({clipData.fullPath})
        if importResult and #importResult > 0 then
            importedClips[slotNum] = importResult[1]
            print("Imported clip for slot " .. slotNum .. ": " .. clipData.filename)
        end
    end
    
    -- Replace clips on timeline
    for slotNum, clipData in pairs(jobData.clips) do
        if importedClips[slotNum] then
            replaceClipAtPosition(timeline, slotNum, clipData, importedClips[slotNum])
        end
    end
    
    -- Save project with new name
    project:SetName(jobData.projectName)
    projectManager:SaveProject()
    
    -- Start render
    startRender(project, jobData.renderSettings)
    
    return true
end

function replaceClipAtPosition(timeline, slotNum, clipData, newMediaItem)
    -- Get track 3 items (based on your current setup)
    local trackItems = timeline:GetItemListInTrack("video", 3)
    
    if trackItems and trackItems[slotNum] then
        local existingItem = trackItems[slotNum]
        
        -- Method 1: Try using takes system
        if existingItem:AddTake(newMediaItem) then
            local takeCount = existingItem:GetTakesCount()
            existingItem:SelectTakeByIndex(takeCount)
            print("Replaced clip " .. slotNum .. " using takes")
            return true
        end
        
        -- Method 2: Delete and re-add
        -- This is more complex but more reliable
        local startFrame = existingItem:GetStart()
        local trackIndex = 3
        
        -- Delete existing
        timeline:DeleteClips({existingItem})
        
        -- Add new clip at same position
        local newItem = {
            mediaPoolItem = newMediaItem,
            startFrame = startFrame,
            endFrame = startFrame + clipData.durationFrames
        }
        
        -- Add to timeline (this syntax may vary by DaVinci version)
        timeline:InsertGeneratorIntoTimeline("Video", startFrame)
        -- You may need to use different methods here
        
        print("Replaced clip " .. slotNum .. " by delete/add")
    end
end

function startRender(project, renderSettings)
    -- Configure render settings
    local settings = {
        SelectAllFrames = true,
        TargetDir = renderSettings.outputPath,
        CustomName = project:GetName(),
        UniqueFilenameStyle = 0,
        ExportVideo = true,
        ExportAudio = true,
        FormatWidth = 1920,
        FormatHeight = 1080,
        FrameRate = "24", -- Match your timeline
        VideoQuality = 0
    }
    
    project:SetRenderSettings(settings)
    
    -- Add to render queue and start
    if project:AddRenderJob() then
        local jobId = project:StartRendering()
        if jobId then
            print("Render started with job ID: " .. jobId)
            
            -- Monitor render progress
            monitorRenderProgress(project, jobId)
        end
    end
end

function monitorRenderProgress(project, jobId)
    while true do
        local status = project:GetRenderJobStatus(jobId)
        
        if status.JobStatus == "Complete" then
            print("Render completed successfully")
            -- Notify web app via webhook
            notifyWebApp("completed", project:GetName())
            break
        elseif status.JobStatus == "Failed" then
            print("Render failed: " .. (status.Error or "Unknown error"))
            notifyWebApp("failed", project:GetName())
            break
        end
        
        -- Wait and check again
        os.execute("sleep 5")
    end
end

function notifyWebApp(status, projectName)
    -- Use curl to notify your web app
    local curlCommand = string.format(
        'curl -X POST "http://localhost:5000/api/davinci/webhook" -H "Content-Type: application/json" -d \'{"status":"%s","project":"%s"}\'',
        status, projectName
    )
    os.execute(curlCommand)
end

-- Main execution - check for job files
function checkForJobs()
    local jobsDir = "./davinci_queue/"
    
    -- Simple file checking (you might need a better file watcher)
    local handle = io.popen('ls ' .. jobsDir .. '*.json 2>/dev/null')
    if handle then
        for filename in handle:lines() do
            local fullPath = jobsDir .. filename
            print("Processing job: " .. filename)
            
            if processJobFile(fullPath) then
                -- Move to completed folder
                os.execute('mv "' .. fullPath .. '" "./davinci_completed/"')
            else
                -- Move to error folder  
                os.execute('mv "' .. fullPath .. '" "./davinci_errors/"')
            end
        end
        handle:close()
    end
end

-- Run the job checker
checkForJobs()
```

## Part 4: Web App Integration

### 4.1 API Endpoint to Trigger Processing
```typescript
// server/routes.ts - Add this endpoint
app.post("/api/recordings/:id/process-and-render", async (req, res) => {
  try {
    const recordingId = req.params.id;
    
    // 1. Process scene segments into clips
    const clipProcessor = new AutomatedClipProcessor();
    const jobFilePath = await clipProcessor.processSceneForDaVinci(recordingId);
    
    // 2. Update database status
    await db.update(flightRecordings)
      .set({ exportStatus: 'processing' })
      .where(eq(flightRecordings.id, recordingId));
    
    res.json({ 
      success: true, 
      message: "Processing started",
      jobFile: jobFilePath 
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Webhook to receive DaVinci completion notifications
app.post("/api/davinci/webhook", async (req, res) => {
  const { status, project } = req.body;
  
  // Extract recording ID from project name
  const recordingId = project.match(/Flight_(.+?)_/)?.[1];
  
  if (recordingId) {
    await db.update(flightRecordings)
      .set({ 
        exportStatus: status === 'completed' ? 'completed' : 'failed',
        driveFileUrl: status === 'completed' ? `./renders/${project}.mp4` : null
      })
      .where(eq(flightRecordings.id, recordingId));
  }
  
  res.json({ success: true });
});
```

### 4.2 Frontend Integration
```typescript
// In your Scene Editor component
const handleExportAndRender = async () => {
  try {
    setProcessingStatus('generating_clips');
    
    // Trigger the full automation pipeline
    const response = await fetch(`/api/recordings/${recordingId}/process-and-render`, {
      method: 'POST'
    });
    
    if (response.ok) {
      setProcessingStatus('rendering');
      
      // Poll for completion
      pollRenderStatus(recordingId);
    }
  } catch (error) {
    console.error('Export failed:', error);
    setProcessingStatus('failed');
  }
};

const pollRenderStatus = async (recordingId: string) => {
  const interval = setInterval(async () => {
    const response = await fetch(`/api/recordings/${recordingId}/status`);
    const { exportStatus } = await response.json();
    
    if (exportStatus === 'completed') {
      setProcessingStatus('completed');
      clearInterval(interval);
    } else if (exportStatus === 'failed') {
      setProcessingStatus('failed');
      clearInterval(interval);
    }
  }, 5000);
};
```

## Part 5: File Structure and Setup

### 5.1 Directory Structure
```
/your-project/
├── clips/              # Generated clip files
├── davinci_queue/      # Job files for DaVinci
├── davinci_completed/  # Processed job files
├── davinci_errors/     # Failed job files
├── renders/           # Final rendered videos
└── davinci_scripts/   # Lua automation scripts
```

### 5.2 DaVinci Setup
1. Place Lua script in DaVinci Scripts folder
2. Set up watch folder monitoring
3. Configure render presets
4. Test with sample job file

## Complete Automation Flow

1. **User finishes scene editing** in web app
2. **Click "Export Video"** triggers automation
3. **FFmpeg generates clips** from scene segments
4. **JSON job file created** with clip mapping
5. **DaVinci Lua script processes** job file automatically
6. **Clips replaced** in template project
7. **Render starts** automatically
8. **Web app notified** when complete
9. **User downloads** final video

**Zero manual DaVinci interaction required!**