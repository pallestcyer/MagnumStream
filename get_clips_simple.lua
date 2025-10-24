-- Simplified DaVinci Resolve Lua Script to get timeline clips
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

-- Try to get video track items instead
local videoTrackCount = timeline:GetTrackCount("video")
print("Video tracks: " .. videoTrackCount)

-- Get items from track 3 (V3 timeline)
if videoTrackCount >= 3 then
    local trackItems = timeline:GetItemListInTrack("video", 3)
    if trackItems then
        print("Found " .. #trackItems .. " clips in video track 3:")
        
        -- Build JSON string and save to file
        local jsonOutput = '{"project_name":"' .. project:GetName() .. '","timeline_name":"' .. timeline:GetName() .. '","frame_rate":' .. frameRate .. ',"clips":['
        
        for i, item in ipairs(trackItems) do
            local startFrame = item:GetStart()
            local durationFrames = item:GetDuration()
            local startSeconds = startFrame / frameRate
            local durationSeconds = durationFrames / frameRate
            local clipName = item:GetName() or ("Clip_" .. i)
            
            if i > 1 then jsonOutput = jsonOutput .. "," end
            jsonOutput = jsonOutput .. '{"slot":' .. i .. ',"name":"' .. clipName .. '","start_frame":' .. startFrame .. ',"duration_frames":' .. durationFrames .. ',"start_seconds":' .. string.format("%.3f", startSeconds) .. ',"duration_seconds":' .. string.format("%.3f", durationSeconds) .. '}'
        end
        
        jsonOutput = jsonOutput .. "]}"
        
        -- Save to file
        local outputFile = io.open("/Users/magnummedia/Desktop/clip_positions_auto.json", "w")
        if outputFile then
            outputFile:write(jsonOutput)
            outputFile:close()
            print("Clip positions saved to clip_positions_auto.json")
        else
            print("Error: Could not save file")
        end 
    else
        print("No items found in track 3")
    end
else
    print("Less than 3 video tracks found - need track V3")
end