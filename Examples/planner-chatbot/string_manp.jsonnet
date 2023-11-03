local str1 = "User: " + payload.str1;
local str2 = "Assistant: " + payload.str2;
local str3 = "Previous Chat: " + payload.str3;
local FINAL_STRING = std.join("\n", [str1, str2, str3]);

{
  "final_string": FINAL_STRING
}