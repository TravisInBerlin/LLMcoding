# WebDJ NEXUS

ブラウザで動作する DJ ミックスアプリです。  
2/4デッキ、Neural Mix系ステム操作、MIDI Learn、録音、ライブラリ、DJ SHOTS を搭載しています。

## 動作環境

- Node.js 18 以上
- Safari / Chrome / Edge (最新版)
- MIDI機器使用時は Web MIDI API 対応ブラウザ

## セットアップ

```bash
npm install
npm run dev
```

- 開発URL: `http://localhost:5173`
- LAN共有: `http://<PCのIP>:5173`

本番ビルド:

```bash
npm run build
npm run preview
```

## 最短スタート

1. 右下 `+ ADD FILES` から曲を取り込む
2. `LIBRARY` の各曲で `A/B/C/D` を押してデッキにロード
3. `PLAY` で再生
4. 必要なら `SYNC` / `KEY MATCH` で合わせる
5. クロスフェーダーか `AUTO DROP` で遷移
6. 録音は `REC START`

## 画面構成

- ヘッダー: デッキ表示、波形表示、ライブラリ表示、AUTO DROP、FEATURES、録音
- 左右デッキ: 波形、TRANSPORT、LOOP、HOT CUE、DJ SHOTS、TEMPO/KEY
- 中央ミキサー: EQ/Stem/FX、VOL/VU、XY FX、クロスフェーダー
- 下部ライブラリ: Library / History / Playlists / My Files / Downloaded / Neural Mix

## ヘッダー操作

- `4 DECK` / `2 DECK`: 2デッキ・4デッキ切替
- `WAVE: H` / `WAVE: V`: 波形の水平/垂直切替
- `LIB: ON/OFF`: ライブラリ表示切替
- `AUTO: A->B / B->A / C->D / D->C`: AUTO DROPルート選択
- `AUTO DROP`: 選択ルートで自動遷移を1回実行
- `FEATURES`: MIDI/CUE/XFADE/AUTOMIX 等の詳細パネル表示
- `REC START`: マスター録音の開始/停止

## FEATURES パネル

- `MIDI CONNECT`: MIDI接続
- `CUE OUT`: ヘッドホンCUE初期化
- `CUE: ...`: CUE出力先選択（setSinkId対応時）
- `CUE A OFF / CUE B OFF`: デッキ別CUE送出
- `CUE LV`: CUE音量
- `Learn: ...`: MIDI Learn対象
- `MIDI LEARN` / `LEARN CANCEL`
- `MIXER HIDE`
- `XFADE: SMOOTH / POWER / NEURAL`
- `GUIDE`
- `AUTOMIX ON/OFF`

## デッキ操作

### TRANSPORT

- `CUE`: 先頭へ戻る
- `PLAY`: 再生/停止
- `SYNC`: 他デッキBPMへ同期
- `KEY MATCH`: 他デッキキーへ同期
- `KEY LOCK`: テンポ変更時の音程維持

### LOOP

- `IN` / `OUT` / `LOOP`: ループ範囲と有効化（再クリックでOFF）
- `SAVE`: 保存待機ON/OFF（`SAVE ON`）
- `MEM 1-4`: ループメモリスロット
  - `SAVE ON`中にタップ: 現在ループを保存
  - 通常タップ: 保存済みループを読込
  - 長押し: スロット削除
- `1B / 2B / 4B / 8B / 16B`: オートループ長

### HOT CUE (実装更新)

- バンク: `1-8` / `9-16`
- 常時 8 PAD 表示
- PAD操作:
  - 未設定PADタップ: セット
  - 設定済PADタップ: ジャンプ
  - PAD長押し: 解除
- `CLR`: ON時、次に押した設定済PADを削除

### DJ SHOTS (実装更新)

ワンタップで効果音:

- `HORN`
- `LASER`
- `CLAP`
- `IMPACT`
- `SIREN`
- `WHISTLE`
- `BELL`
- `RISER`

## AUTO DROP と AUTOMIX

### AUTO DROP

- 手動一発遷移
- ルート選択に応じて `A->B / B->A / C->D / D->C` で実行
- 遷移時にBPM/Key補正とFX補助を適用

### AUTOMIX ON の挙動

- 12秒ごとに `AUTO` で選択中のルートを自動実行
- 実行フロー:
  1. ルート対象の2デッキがロード済みか確認
  2. 両方停止ならソース側を再生開始
  3. ターゲット未再生ならBPM同期・キー補正して再生
  4. XFADEスタイルに応じたFXでフェード遷移
- OFFで自動実行停止

## MIDI Learn

割当対象:

- Play/Cue/Sync/KeyMatch (A/B)
- Crossfader
- Volume/Tempo/Filter (A/B)
- Stem Vocal/Drums/Instruments (A/B)

手順:

1. `MIDI CONNECT`
2. `Learn: ...` で対象選択
3. `MIDI LEARN`
4. コントローラーを操作

## 録音

- `REC START` で開始
- 再度押すと停止し自動ダウンロード
- 出力拡張子は環境で変動 (`webm` / `m4a` など)

## トラブルシュート

### ボタン反応がおかしい

```bash
pkill -f vite
npm run dev
```

その後 `Shift + Reload` でハードリロード。

### Safari で無音

- 最初に画面を1回タップして AudioContext を開始
- 出力先デバイスとブラウザ自動再生設定を確認

### 4 DECK 切替できない

- 古いポートに接続していないか確認
- `http://localhost:5173` を再読込

## コード構成 (リファクタリング後)

- `src/main.ts`: UI初期化とイベント配線
- `src/audio/AutoDrop.ts`: AUTO DROP/AUTOMIX遷移ロジック
- `src/audio/SfxEngine.ts`: DJ SHOTS効果音生成
- `src/audio/cuePalette.ts`: HOT CUEカラー共通定義
- `src/ui/*`: Deck/Mixer/Library UI

この構成により、機能追加時の影響範囲を分離しやすくしています。
