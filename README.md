# 天天學字 📖

給 65 歲以上長輩的繁體中文識字網站:從 ㄅㄆㄇ 暖身,重點是**生活識字**——
長輩早就會「說」,這裡幫他們把每天說的話,一個字一個字「認」回來。

## 特色

- **三階段課程,共 63 關**:
  1. 注音暖身(10 關)→ 2. 識字主課程(10 單元 × 5 關)→ 3. 檢定挑戰(3 回模擬考)
- **識字為核心**:10 個生活主題單元(數字錢幣、日子時間、家人、吃喝、路上標示、買東西、搭車、健康、天氣、常用會話),共 127 字,每字有注音、例詞、生活例句
- **每單元五關**:學一學 → 聽聲音 → 看圖選字 → 句子填空 → 寫一寫(手寫描字)
- **檢定挑戰**:仿全民中檢(初等)題型的原創模擬考(選字填空、同音形近字、聽寫選字、語意理解、短文閱讀),80 分通過,作為銜接正式檢定的訓練
- **每天一點點**:首頁「今天的任務」、連續學習 🔥、集章月曆、10 種徽章
- **滿滿的鼓勵**:答對有拍手聲、彩帶、語音讚美;答錯只有溫柔提示,不扣分
- **給長輩的介面**:超大字體按鈕、高對比、每頁 🔊 語音說明(不識字也能用)
- **免登入**:自動產生 6 碼「學號」,換裝置輸入學號即可找回進度
- **每個選單獨立網址**:`/units`、`/unit/3/listen`、`/bpmf`、`/games`、`/write/媽`、`/rewards`…

## 技術

- 純前端 Vanilla JS SPA(無建置步驟),History API 路由 + `_redirects` fallback
- 語音:瀏覽器內建 `speechSynthesis`(zh-TW);音效:Web Audio 合成拍手/叮咚
- 部署:Cloudflare Pages;進度:localStorage + Pages Functions + Cloudflare KV

## 開發

```bash
npx wrangler pages dev public   # 本機開發(含 API 與 KV)
npx wrangler pages deploy public # 部署
```

## 結構

```
public/            靜態網站
  js/data/units.js 識字課程內容(要加字加單元改這裡)
  js/data/bpmf.js  注音符號資料
  js/app.js        路由與畫面
functions/         Cloudflare Pages Functions(進度 API)
wrangler.toml      Cloudflare 設定(KV 綁定)
```
