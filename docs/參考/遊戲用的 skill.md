# 遊戲用的 skill（番外篇）

2026-10-16 為了像素遊戲（番外篇）找的第三方 skill。用 `find-skills` 搜尋，挑安裝數、來源 repo 星數夠，而且不綁 Unity／Godot、不用付費 API key 的。內容都讀過一遍，沒有可疑的指令（不會叫 agent 下載執行程式、讀密鑰、忽略規則）。

**不放進 repo**：其中 `gamedev-skills`、`mengto` 兩個來源沒有寫授權，重新散布不妥，所以 `.claude/skills/` 在 `.gitignore` 裡，要用時照下面裝回來。

## 清單

| skill | 來源 | 用途 | 審過的版本（指紋） |
|---|---|---|---|
| game-feel | gamedev-skills/awesome-gamedev-agent-skills | 手感：畫面震動、停頓、縮放回饋，回饋分輕重三級（範例是 Godot／Unity，原則通用） | 542e6dc46e32f52c |
| dialogue-systems | gamedev-skills/awesome-gamedev-agent-skills | 對話資料：節點、選項、條件、旗標，自己寫小的執行器 | 3a8677aa30348045 |
| rpg | gamedev-skills/awesome-gamedev-agent-skills | 任務、道具、存檔的結構 | b33c8151ccbea8af |
| procedural-gen | gamedev-skills/awesome-gamedev-agent-skills | 用種子與規則生成地圖（同一個種子結果一樣） | 7edf1be932630419 |
| game-audio | playableintelligence/game-creator（MIT） | Web Audio 的音序器與音效，不用音檔 | 78816142cef0205d |
| build-game-audio-feedback | mengto/skills | 音效設計原則：哪些動作要有聲音、手機要先點一下、靜音、字幕替代 | b067714d81c99a5b |
| test-playable-web-games | mengto/skills | 遊戲的測試矩陣：桌機、手機直／橫、減少動態；用種子直接跳到某個狀態 | a9f4179317cc953b |
| game-engine | github/awesome-copilot | canvas 遊戲迴圈、碰撞、tilemap、鍵盤／觸控／手把輸入 | 9515a66b29a2e274 |

注意：
- `game-audio` 有一段建議改用 Strudel 做背景音樂。Strudel 是 AGPL-3.0，用了整個網站都要照 AGPL 開放，**不用**；音樂、音效都只用 Web Audio。
- 沒選的：ElevenLabs、Layer、Suno（要對方的 API key，多半付費）、Unity／Godot 專用的、像素美術類（數字偏低，而且我們有自己的一套）。

## 怎麼裝

```bash
cd /home/user/hitomeguri   # repo 根目錄
npx -y skills add https://github.com/gamedev-skills/awesome-gamedev-agent-skills --skill game-feel --skill dialogue-systems --skill rpg --skill procedural-gen -a claude-code --copy -y
npx -y skills add https://github.com/playableintelligence/game-creator --skill game-audio -a claude-code --copy -y
npx -y skills add https://github.com/mengto/skills --skill build-game-audio-feedback --skill test-playable-web-games -a claude-code --copy -y
npx -y skills add https://github.com/github/awesome-copilot --skill game-engine -a claude-code --copy -y
rm -f skills-lock.json
# 比對指紋：跟上表一樣就是審過的版本；不一樣要重新讀過再用
cd .claude/skills && for d in */; do d=${d%/}; echo "$d $(find $d -type f | sort | xargs cat | sha256sum | cut -c1-16)"; done
```

裝完要開新的 session（或重新載入）skill 才會出現在可用清單；也可以直接讀 `.claude/skills/<名稱>/SKILL.md`。
