# 桌宠状态覆盖记录

15 个角色 × 9 个任务状态，共135个绑定。两批累计新增56个状态，既有动作定向复用5个，原有专属动作50个，通用回退24个。未知工具采用10个停手观察末帧复用，其余5个角色保持中性idle。

|角色|thinking|responding|searching|editing|commanding|testing|waiting|success|error|
|---|---|---|---|---|---|---|---|---|---|
|gpt|thinking（原有专属动作）|authored_responding（本轮新增）|searching（原有专属动作）|editing（原有专属动作）|commanding（原有专属动作）|testing（原有专属动作）|waiting（原有专属动作）|success（原有专属动作）|error（原有专属动作）|
|stella|working（通用回退）|idle（通用回退）|working（通用回退）|working（通用回退）|working（通用回退）|working（通用回退）|waiting（原有专属动作）|success（原有专属动作）|error（原有专属动作）|
|qwen|authored_thinking（本轮新增）|authored_responding（本轮新增）|authored_searching（本轮新增）|working（既有动作定向复用）|authored_commanding（本轮新增）|authored_testing（本轮新增）|waiting（原有专属动作）|success（原有专属动作）|error（原有专属动作）|
|kimi|authored_thinking（本轮新增）|authored_responding（本轮新增）|working（既有动作定向复用）|authored_editing（本轮新增）|authored_commanding（本轮新增）|authored_testing（本轮新增）|waiting（原有专属动作）|success（原有专属动作）|error（原有专属动作）|
|glm|authored_thinking（本轮新增）|authored_responding（本轮新增）|authored_searching（本轮新增）|authored_editing（本轮新增）|authored_commanding（本轮新增）|authored_testing（本轮新增）|waiting（原有专属动作）|success（原有专属动作）|error（原有专属动作）|
|minimax|authored_thinking（本轮新增）|authored_responding（本轮新增）|authored_searching（本轮新增）|authored_editing（本轮新增）|authored_commanding（本轮新增）|authored_testing（本轮新增）|waiting（原有专属动作）|success（原有专属动作）|error（原有专属动作）|
|llama|authored_thinking（本轮新增）|authored_responding（本轮新增）|authored_searching（本轮新增）|authored_editing（本轮新增）|authored_commanding（本轮新增）|authored_testing（本轮新增）|waiting（原有专属动作）|success（原有专属动作）|error（原有专属动作）|
|doubao|working（通用回退）|idle（通用回退）|working（通用回退）|working（通用回退）|working（通用回退）|working（通用回退）|waiting（原有专属动作）|success（原有专属动作）|error（原有专属动作）|
|mistral|working（通用回退）|idle（通用回退）|working（通用回退）|working（通用回退）|working（通用回退）|working（通用回退）|waiting（原有专属动作）|success（原有专属动作）|error（原有专属动作）|
|deepseek|thinking（原有专属动作）|authored_responding（本轮新增）|authored_searching（本轮新增）|working（既有动作定向复用）|authored_commanding（本轮新增）|authored_testing（本轮新增）|waiting（原有专属动作）|success（原有专属动作）|error（原有专属动作）|
|claude|authored_thinking（本轮新增）|authored_responding（本轮新增）|authored_searching（本轮新增）|working（既有动作定向复用）|authored_commanding（本轮新增）|authored_testing（本轮新增）|waiting（原有专属动作）|success（原有专属动作）|error（原有专属动作）|
|gemini|authored_thinking（本轮新增）|authored_responding（本轮新增）|authored_searching（本轮新增）|working（既有动作定向复用）|authored_commanding（本轮新增）|authored_testing（本轮新增）|waiting（原有专属动作）|success（原有专属动作）|error（原有专属动作）|
|grok|working（通用回退）|idle（通用回退）|working（通用回退）|working（通用回退）|working（通用回退）|working（通用回退）|waiting（原有专属动作）|success（原有专属动作）|error（原有专属动作）|
|hunyuan|authored_thinking（本轮新增）|authored_responding（本轮新增）|authored_searching（本轮新增）|authored_editing（本轮新增）|authored_commanding（本轮新增）|authored_testing（本轮新增）|waiting（原有专属动作）|success（原有专属动作）|error（原有专属动作）|
|mimo|authored_thinking（本轮新增）|authored_responding（本轮新增）|authored_searching（本轮新增）|authored_editing（本轮新增）|authored_commanding（本轮新增）|authored_testing（本轮新增）|authored_waiting（本轮新增）|success（原有专属动作）|error（原有专属动作）|
