# Battery Lens｜電池透視

繁體中文電池報告分析網站。純 HTML/CSS/JavaScript，不需後端或安裝依賴，可直接部署到 GitHub Pages。檔案在瀏覽器的 Web Worker 中解析，沒有報告上傳、追蹤程式或 localStorage。

## 使用網站

1. 開啟網站，點選「匯入檔案」，選擇一份 Android ZIP/TXT 或 iPhone 分析記錄；亦可用「貼上文字」。
2. 可先點「試試範例報告」：合成資料結果為 **86.4%**，並非你的手機測量結果。
3. ZIP 若含多份相關報告，用「報告來源」逐一切換。各 TXT 分開計算，不混合不同報告；同一個 sysfs 電池目錄的檔案才合併。
4. 展開「原始欄位」，查看欄位、原始值、換算值、來源檔名與行號。
5. 若有滿充容量、但沒有設計容量，可根據該手機或電池的官方規格手動輸入 **mAh**，按「套用」。手動值會明確標示並記錄到摘要。切換來源會清除手動值。
6. 「下載分析摘要」產生 JSON；摘要包含已辨識欄位及檔名，分享前檢查。「清除本次資料」會終止解析工作並釋放本頁引用。

## Android：取得偵錯報告

1. 設定 → 關於手機，連點版本號碼 7 次，依提示啟用開發人員選項。不同品牌名稱及位置可能不同。
2. 開發人員選項 → 擷取錯誤報告／提交錯誤報告；若可選，使用完整報告。
3. 等待通知完成，將 ZIP 儲存到手機的檔案，再匯入網站。
4. ZIP 無法讀取時，先解壓縮並選擇 `bugreport-….txt` 或 `dumpstate_board.txt`。請以新版瀏覽器開啟網站。

使用電腦：安裝 [Android 官方 Platform Tools](https://developer.android.com/tools/releases/platform-tools)，開啟 USB 偵錯、連接手機並允許這台電腦，執行：

```sh
adb bugreport battery-report.zip
```

不需 root。報告內容由廠商決定；有些手機不提供滿充／設計容量，因此無法用報告計算。不要以解鎖或 root 作為必要步驟。

## iPhone：取得分析記錄（實驗性）

1. 優先在設定 → 電池 → 電池健康度查看系統結果。名稱與項目依機型／版本不同。
2. 設定 → 隱私權與安全性 → 分析與改進 → 分析資料，尋找近期 `Analytics-…` 或 `log-aggregated-…` 記錄。
3. 用分享選單儲存到「檔案」，匯入網站或貼上文字。不是每份 IPS 都有電池資料。
4. 若沒有記錄，可自行決定是否開啟「分享 iPhone 分析資料」並等候後續產生。這會把分析資料分享給 Apple，不保證生成時間或欄位。

**Apple 未公開保證以下欄位的格式與語意。** 本工具只做白名單相容性讀取，不保證所有 iOS 版本，不取代系統的健康度。`MaximumFCC` 沒有被假定為設計容量。

## 計算與支援欄位

估算健康度 = **滿充容量 ÷ 設計容量 × 100%**。例如 4,320 / 5,000 = 86.4%。

| 類型 | 支援欄位 | 無明確單位時 |
|---|---|---|
| Android 滿充容量 | `POWER_SUPPLY_CHARGE_FULL`、`charge_full`、`batteryFullChargeUah`、`Full charge`、`Full charge capacity` | µAh（除以 1000 換成 mAh） |
| Android 設計容量 | `POWER_SUPPLY_CHARGE_FULL_DESIGN`、`charge_full_design`、`batteryFullChargeDesignCapacityUah` | µAh |
| Android 循環 | `POWER_SUPPLY_CYCLE_COUNT`、`cycle_count`、`batteryCycleCount`、`Cycle count` | 次 |
| iPhone 百分比 | `MaximumCapacityPercent`，可有 `last_value_` 前綴 | %，優先顯示 |
| iPhone 容量 | `NominalChargeCapacity`、`DesignCapacity`，可有 `last_value_` 前綴 | mAh（實驗性假設） |
| iPhone 循環 | `CycleCount`，可有 `last_value_` 前綴 | 次 |

支援 `key: number`、`key=number` 與 JSON 鍵值片段；Android 支援電池 sysfs 路徑後接同／下一行數值。容量明示 mAh、uAh、µAh 或 μAh 時以明示單位為準。

- **不採用** `level`、`health: 2`、`charge_counter`、`Estimated battery capacity` 等欄位推算健康度。
- 正值容量有效範圍為 10～100,000 mAh；負數、零容量、非有限數值不採用。循環次數可為 0。
- 同欄位有不同數值時不任選；不同平台或已辨識的多個電池路徑阻止自動計算。無法辨識所有廠商格式、歷史時間與電池身分；同值也不能證明同一來源。
- iPhone 百分比存在但互相矛盾時不退回計算容量比。百分比與容量比差異大於 3 個百分點會提示。
- 超過 100% 的合理原始比例予以保留並提醒；低於 1% 或高於 150% 的計算比例視為異常。
- 本頁不做電池故障診斷、保固判斷或是否必須更換的結論。溫度、校準、電量計與廠商實作會影響結果。

## 檔案格式、隱私與限制

- 文字檔可為 TXT、LOG、JSON、IPS、IPS.CA.SYNCED；支援 UTF-8 與含 BOM 的 UTF-16。
- 每份檔案上限 80 MiB；貼上文字上限 20 Mi 字元。較大的報告請先選取相關段落。
- ZIP 僅讀取 `bugreport*.txt`、`dumpstate*.txt` 及 `power_supply/<電池>/charge_full`、`charge_full_design`、`cycle_count`。不是任意 ZIP 分析器；不讀圖片或其他私人檔案。
- ZIP 支援 Store / Deflate、CRC32 檢查。最多 10,000 個索引項，選中的報告最多 100 個、解壓總量 120 MiB。不支援 ZIP64、加密、分卷 ZIP、巢狀壓縮；請先解壓並選取文字檔。
- ZIP Deflate 使用瀏覽器原生 `DecompressionStream('deflate-raw')`。不支援的瀏覽器請先解壓；文字解析需要 Worker 與 ES modules。
- 不使用第三方 CDN、字型或分析服務。CSP 的 `connect-src 'none'` 禁止應用程式發送報告網路請求；靜態資源仍需由網站主機載入。
- GitHub Pages 一般存取記錄與網站請求仍受 GitHub 隱私政策約束。報告本身不離開瀏覽器，除非使用者自行另行分享。
- 清除資料是解除記憶體引用，並非密碼學安全抹除。請勿將真實報告放到儲存庫或 issue。

## 本機開發與驗證

需 Node.js 22 或更新版，不必 `npm install`。

```sh
npm test
npm run dev
```

開啟 `http://127.0.0.1:4173`。不要直接雙擊 HTML 使用 `file://`，瀏覽器會限制 module Worker。

測試涵蓋容量單位、假健康度欄位排除、手動容量、缺值、衝突、多電池、iPhone 欄位、超過 100%、ZIP 壓縮與完整性、大小限制、UTF-16。

## 發布至 GitHub Pages（不需 Actions 權杖）

1. 登入 GitHub，建立公開儲存庫，例如 `battery-lens`。
2. 上傳此資料夾內容；`index.html`、`app.js`、`parser.js`、`worker.js`、`zip.js`、CSS 與圖示必須在根目錄。保留 `.nojekyll`。不要上傳手機報告。
3. Settings → Pages → Build and deployment。
4. Source 選 **Deploy from a branch**，Branch 選 **main**，資料夾選 **/ (root)**，按 Save。
5. 在 Actions 等待 `pages build and deployment` 成功，再開啟 Pages 顯示的網址，通常是 `https://你的帳號.github.io/battery-lens/`。
6. 之後更新 main 檔案即可重新部署。所有資源使用相對路徑，支援專案子目錄。

若 Pages 顯示 404，確認分支與資料夾、根目錄 index.html 以及建置狀態；若私人庫無法使用 Pages，依 GitHub 方案調整或使用公開庫。

## 來源

- [Android 擷取與閱讀偵錯報告](https://developer.android.com/studio/debug/bug-report)
- [AOSP Health HAL 與設計容量單位](https://source.android.com/docs/core/perf/health)
- [AOSP BatteryMonitor 欄位與 sysfs 對應](https://android.googlesource.com/platform/system/core/+/refs/heads/master/healthd/BatteryMonitor.cpp)
- [Apple 分享分析與診斷資料](https://support.apple.com/108971)
- [GitHub Pages 發布來源設定](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)

以上官方文件支持報告取得方式、Android 欄位與部署流程；**Apple 文件並未保證本工具讀取的內部電池欄位**。

## 授權

MIT，見 LICENSE。
