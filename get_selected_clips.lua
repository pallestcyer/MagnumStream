-- DaVinci Resolve Lua Script to get selected clips and output JSON
-- Run this in DaVinci Resolve Console (Lua mode)

-- Get current project and timeline
local resolve = Resolve()
local projectManager = resolve:GetProjectManager()
local project = projectManager:GetCurrentProject()

if not project then
    print('{"error": "No project loaded"}')
    return
end

local timeline = project:GetCurrentTimeline()
if not timeline then
    print('{"error": "No timeline active"}')
    return
end

-- Get selected timeline items
local selectedItems = timeline:GetSelectedItems()

if not selectedItems or #selectedItems == 0 then
    print('{"error": "No clips selected"}')
    return
end

-- Get timeline frame rate
local frameRate = timeline:GetSetting("timelineFrameRate")

-- Build JSON output
local output = {
    project_name = project:GetName(),
    timeline_name = timeline:GetName(),
    frame_rate = tonumber(frameRate),
    clips = {}
}

-- Process each selected clip
for i, item in ipairs(selectedItems) do
    local startFrame = item:GetStart()
    local endFrame = item:GetEnd()
    local durationFrames = item:GetDuration()
    
    -- Convert to seconds
    local startSeconds = startFrame / frameRate
    local durationSeconds = durationFrames / frameRate
    
    -- Get clip name
    local clipName = item:GetName() or ("Clip_" .. i)
    
    -- Build clip data
    local clipData = {
        slot = i,
        name = clipName,
        start_frame = startFrame,
        duration_frames = durationFrames,
        start_seconds = math.floor(startSeconds * 1000) / 1000, -- Round to 3 decimals
        duration_seconds = math.floor(durationSeconds * 1000) / 1000
    }
    
    table.insert(output.clips, clipData)
end

-- Convert to JSON string manually (Lua doesn't have built-in JSON)
function tableToJson(t)
    local result = {}
    local isArray = true
    local count = 0
    
    -- Check if it's an array
    for k, v in pairs(t) do
        count = count + 1
        if type(k) ~= "number" or k ~= count then
            isArray = false
            break
        end
    end
    
    if isArray then
        table.insert(result, "[")
        for i, v in ipairs(t) do
            if i > 1 then table.insert(result, ",") end
            if type(v) == "table" then
                table.insert(result, tableToJson(v))
            elseif type(v) == "string" then
                table.insert(result, '"' .. v .. '"')
            else
                table.insert(result, tostring(v))
            end
        end
        table.insert(result, "]")
    else
        table.insert(result, "{")
        local first = true
        for k, v in pairs(t) do
            if not first then table.insert(result, ",") end
            first = false
            table.insert(result, '"' .. k .. '":')
            if type(v) == "table" then
                table.insert(result, tableToJson(v))
            elseif type(v) == "string" then
                table.insert(result, '"' .. v .. '"')
            else
                table.insert(result, tostring(v))
            end
        end
        table.insert(result, "}")
    end
    
    return table.concat(result)
end

-- Output the JSON
print(tableToJson(output))