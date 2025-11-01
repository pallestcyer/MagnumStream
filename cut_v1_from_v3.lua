-- DaVinci Resolve Lua Script to cut V1 based on V3 clip positions
-- Run this in DaVinci Resolve Console (Lua mode)

local resolve = Resolve()
local projectManager = resolve:GetProjectManager()
local project = projectManager:GetCurrentProject()

if not project then
    print("Error: No project loaded")
    return
end

local timeline = project:GetCurrentTimeline()
if not timeline then
    print("Error: No timeline active")
    return
end

-- Get timeline frame rate
local frameRate = timeline:GetSetting("timelineFrameRate")
print("Frame Rate: " .. frameRate)
print("Project: " .. project:GetName())
print("Timeline: " .. timeline:GetName())

-- Get video track count
local videoTrackCount = timeline:GetTrackCount("video")
print("Video tracks: " .. videoTrackCount)

-- Verify we have both V1 and V3
if videoTrackCount < 3 then
    print("Error: Need at least 3 video tracks (V1 and V3)")
    return
end

-- Get V3 clips to determine cut points
local v3TrackItems = timeline:GetItemListInTrack("video", 3)
if not v3TrackItems or #v3TrackItems == 0 then
    print("Error: No clips found in V3")
    return
end

print("Found " .. #v3TrackItems .. " clips in V3")

-- Collect all cut positions (start and end of each V3 clip)
local cutPositions = {}
for i, item in ipairs(v3TrackItems) do
    local startFrame = item:GetStart()
    local durationFrames = item:GetDuration()
    local endFrame = startFrame + durationFrames

    table.insert(cutPositions, startFrame)
    table.insert(cutPositions, endFrame)

    print("V3 Clip " .. i .. ": " .. startFrame .. " to " .. endFrame)
end

-- Remove duplicates and sort
table.sort(cutPositions)
local uniqueCutPositions = {}
local lastPos = -1
for _, pos in ipairs(cutPositions) do
    if pos ~= lastPos then
        table.insert(uniqueCutPositions, pos)
        lastPos = pos
    end
end

print("\nCut positions needed: " .. #uniqueCutPositions)
for i, pos in ipairs(uniqueCutPositions) do
    print("  Cut " .. i .. ": Frame " .. pos .. " (" .. string.format("%.3f", pos/frameRate) .. "s)")
end

-- Get V1 clip
local v1TrackItems = timeline:GetItemListInTrack("video", 1)
if not v1TrackItems or #v1TrackItems == 0 then
    print("\nError: No clips found in V1")
    return
end

print("\nFound " .. #v1TrackItems .. " clip(s) in V1")

-- Note: The Resolve Lua API doesn't have a direct blade/split function
-- We'll create markers at cut positions as a reference
-- You can then manually blade at these positions, or use the Python API if available

print("\nCreating markers at cut positions...")
local markerCount = 0
for i, cutFrame in ipairs(uniqueCutPositions) do
    local markerName = "CUT_" .. i
    local color = "Blue"

    -- Add marker at cut position
    -- Note: AddMarker takes frame number, name, color, note, duration, customData
    local success = timeline:AddMarker(cutFrame, color, markerName, "Auto-cut from V3", 1, "")

    if success then
        markerCount = markerCount + 1
        print("  Added marker '" .. markerName .. "' at frame " .. cutFrame)
    else
        print("  Failed to add marker at frame " .. cutFrame)
    end
end

print("\n" .. markerCount .. " markers created!")
print("\nNOTE: DaVinci Resolve Lua API doesn't support automatic blade operations.")
print("Please use the Python API or manually blade V1 at the marked positions.")
print("\nAlternative: Use Python API with timeline.ApplyGradeFromClips() or similar methods.")
