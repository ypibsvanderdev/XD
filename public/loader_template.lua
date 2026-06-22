--[[
    ========================================================
             XD PREMIUM LICENSE MANAGER LOADER
    ========================================================
    To run this script, replace your license key below.
]]

local LICENSE_KEY = "XD-YOUR-KEY-HERE"
local SERVER_URL = "http://localhost:3005" -- Update this to your deployed web domain address

-- Helper check to verify if script executor has required HTTP libraries
if not game or not game.HttpGet then
    error("XD Error: Your executor does not support game:HttpGet to download code.")
end

local function validateAndRun()
    print("[XD] Validating license key with authentication server...")
    
    local validationUrl = SERVER_URL .. "/api/validate?key=" .. tostring(LICENSE_KEY)
    local success, response = pcall(function()
        return game:HttpGet(validationUrl)
    end)
    
    if not success then
        error("XD Error: Failed to reach the validation server. Check your internet connection or server status. Details: " .. tostring(response))
    end
    
    -- Check if server returned a syntax error wrapper, invalid response, or error payload
    if response:match("XD Validation Error:") then
        error(response)
    end

    print("[XD] Key validated successfully! Starting execution...")
    
    -- Load and run the returned script payload
    local run, loadError = loadstring(response)
    if not run then
        error("XD Error: Failed to load execution payload. Syntax Error: " .. tostring(loadError))
    end
    
    run()
end

validateAndRun()
