-- Simplified DaVinci Resolve Lua Script to get timeline clips
-- Run this in DaVinci Resolve Console (Lua mode)

-- Get user's home directory and set Desktop as output location
local homeDir = os.getenv("HOME") or os.getenv("USERPROFILE")
local desktopPath = homeDir .. "/Desktop/"

-- Debug logging to Desktop
local debugLogPath = desktopPath .. "davinci_debug.log"
local debug = io.open(debugLogPath, "w")
if debug then
    debug:write("Script started\n")
    debug:write("Debug log path: " .. debugLogPath .. "\n")
else
    io.write("DEBUG: Could not create debug log at " .. debugLogPath .. "\n")
    io.flush()
end

local resolve = Resolve()
if not resolve then
    debug:write("ERROR: Could not get Resolve instance\n")
    debug:close()
    io.write('{"error":"Could not get Resolve instance"}')
    io.flush()
    os.exit(1)
end

local projectManager = resolve:GetProjectManager()
if not projectManager then
    debug:write("ERROR: Could not get Project Manager\n")
    debug:close()
    io.write('{"error":"Could not get Project Manager"}')
    io.flush()
    os.exit(1)
end

local project = projectManager:GetCurrentProject()
if not project then
    debug:write("ERROR: No project loaded\n")
    debug:close()
    io.write('{"error":"No project loaded"}')
    io.flush()
    os.exit(1)
end

local timeline = project:GetCurrentTimeline()
if not timeline then
    debug:write("ERROR: No timeline active\n")
    debug:close()
    io.write('{"error":"No timeline active"}')
    io.flush()
    os.exit(1)
end

-- Get timeline frame rate
local frameRate = timeline:GetSetting("timelineFrameRate")
debug:write("Frame Rate: " .. tostring(frameRate) .. "\n")
debug:write("Project: " .. project:GetName() .. "\n")
debug:write("Timeline: " .. timeline:GetName() .. "\n")

-- Get track counts
local videoTrackCount = timeline:GetTrackCount("video")
local audioTrackCount = timeline:GetTrackCount("audio")
debug:write("Video tracks: " .. tostring(videoTrackCount) .. "\n")
debug:write("Audio tracks: " .. tostring(audioTrackCount) .. "\n")

-- Try multiple methods to get clips from V3
debug:write("\n=== Attempting to get clips from V3 ===\n")

-- Method 1: GetItemListInTrack
debug:write("Method 1: GetItemListInTrack('video', 3)\n")
local trackItems = timeline:GetItemListInTrack("video", 3)
if trackItems then
    debug:write("  Result type: " .. type(trackItems) .. "\n")
    if type(trackItems) == "table" then
        debug:write("  Items count: " .. #trackItems .. "\n")
        if #trackItems > 0 then
            debug:write("  First item type: " .. type(trackItems[1]) .. "\n")
            debug:write("  First item name: " .. tostring(trackItems[1]:GetName()) .. "\n")
        else
            debug:write("  Table is empty\n")
        end
    end
else
    debug:write("  Result is nil\n")
end

-- Method 2: Try getting all timeline items and filter
debug:write("\nMethod 2: Checking all timeline items\n")
local allItems = timeline:GetItemsInTrack("video", 3)
if allItems then
    debug:write("  GetItemsInTrack result: " .. type(allItems) .. "\n")
    if type(allItems) == "table" then
        debug:write("  Count: " .. #allItems .. "\n")
    end
else
    debug:write("  GetItemsInTrack returned nil\n")
end

-- Method 3: Check timeline start/end
debug:write("\nMethod 3: Timeline boundaries\n")
local startFrame = timeline:GetStartFrame()
local endFrame = timeline:GetEndFrame()
debug:write("  Start frame: " .. tostring(startFrame) .. "\n")
debug:write("  End frame: " .. tostring(endFrame) .. "\n")

-- Try checking if track exists
debug:write("\nChecking track 3 accessibility:\n")
for track = 1, videoTrackCount do
    local items = timeline:GetItemListInTrack("video", track)
    if items then
        debug:write("  Track " .. track .. ": " .. #items .. " items\n")
    else
        debug:write("  Track " .. track .. ": nil result\n")
    end
end

-- If we got items, build JSON
if trackItems and #trackItems > 0 then
    debug:write("\n=== Building JSON output ===\n")
    local jsonOutput = '{"project_name":"' .. project:GetName() .. '","timeline_name":"' .. timeline:GetName() .. '","frame_rate":' .. frameRate .. ',"clips":['

    for i, item in ipairs(trackItems) do
        debug:write("Processing clip " .. i .. "\n")
        local startFrame = item:GetStart()
        local durationFrames = item:GetDuration()
        local startSeconds = startFrame / frameRate
        local durationSeconds = durationFrames / frameRate
        local clipName = item:GetName() or ("Clip_" .. i)

        debug:write("  Name: " .. clipName .. ", Start: " .. startFrame .. ", Duration: " .. durationFrames .. "\n")

        if i > 1 then jsonOutput = jsonOutput .. "," end
        jsonOutput = jsonOutput .. '{"slot":' .. i .. ',"name":"' .. clipName .. '","start_frame":' .. startFrame .. ',"duration_frames":' .. durationFrames .. ',"start_seconds":' .. string.format("%.3f", startSeconds) .. ',"duration_seconds":' .. string.format("%.3f", durationSeconds) .. '}'
    end

    jsonOutput = jsonOutput .. "]}"

    -- Save JSON to file and output to console (also to Desktop)
    local outputPath = desktopPath .. "clip_positions_auto.json"
    local outputFile = io.open(outputPath, "w")
    if outputFile then
        outputFile:write(jsonOutput)
        outputFile:close()
        debug:write("Clip positions saved to " .. outputPath .. "\n")
        io.write(jsonOutput)
        io.flush()
    else
        debug:write("Error: Could not save file to " .. outputPath .. "\n")
    end
else
    debug:write("\n=== NO CLIPS FOUND ===\n")
    io.write('{"error":"No clips found on track 3","debug":"Check debug.log for details"}')
    io.flush()
end

-- Close debug log and exit cleanly
debug:close()
os.exit(0)
