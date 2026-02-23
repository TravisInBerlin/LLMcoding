# WebDJ NEXUS

ブラウザ上で動く DJ ミックスアプリです。`djay` 風の2/4デッキ、Neural Mix系のステム操作、MIDI Learn、録音、ライブラリ管理をまとめています。

## 動作環境

- Node.js 18 以上推奨
- Safari / Chrome / Edge (最新)
- MIDI コントローラー使用時: Web MIDI API 対応ブラウザ

## セットアップ

```bash
npm install
npm run dev
```

- 開発URL: `http://localhost:5173`
- 同一LANからアクセスする場合: `http://<PCのIP>:5173`

本番ビルド:

```bash
npm run build
npm run preview
```

## 最短スタート (3分)

1. 右上の `ADD FILES` か右下の `+ ADD FILES` で曲を取り込む
2. `LIBRARY` タブの曲カードで `A` or `B` を押してデッキにロード
3. 各デッキの `PLAY` で再生
4. 必要なら `SYNC` と `KEY MATCH` でテンポ/キーを合わせる
5. 中央下のクロスフェーダーで A/B をミックス
6. 録音する場合は `REC START` を押す（再度押すと停止して書き出し）

## 画面構成

- 上部ヘッダー: 全体切替・MIDI・録音
- 左右デッキ: 再生/ループ/ホットキュー/テンポ/キー
- 中央ミキサー: EQ/FX/ステム/チャンネルボリューム/VU/XY FX/クロスフェーダー
- 下部ライブラリ: 曲管理・履歴・プレイリスト系ビュー

## 上部ボタン一覧

- `MIDI CONNECT`: MIDI機器を接続
- `Learn: ...`: MIDI Learn の割当対象を選択
- `MIDI LEARN`: 次に受けた MIDI 入力を対象へ割当
- `LEARN CANCEL`: 学習モード中断（`Esc` でも可）
- `MIXER HIDE`: 中央ミキサー表示切替
- `LIBRARY HIDE`: 下部ライブラリ表示切替
- `ADD FILES`: 曲取り込みダイアログを開く
- `4 DECK` / `2 DECK`: デッキ表示数切替
- `WAVE: H` / `WAVE: V`: 波形表示方向切替
- `XFADE: SMOOTH/POWER/NEURAL`: クロスフェード特性
- `AUTO DROP`: A/B 自動トランジションを1回実行
- `AUTOMIX ON/OFF`: 一定間隔の自動トランジション
- `GUIDE`: 操作ガイド表示
- `REC START`: マスター録音開始/停止

## デッキ操作

### TRANSPORT

- `CUE`: 先頭へ戻る
- `PLAY`: 再生/停止
- `SYNC`: 反対デッキへ BPM 同期
- `KEY MATCH`: 反対デッキへキー同期
- `KEY LOCK`: ON でテンポ変更時に音程維持

### LOOP

- `IN`: ループ開始点 ON/OFF
- `OUT`: ループ終了点 ON/OFF
- `LOOP`: ループ有効 ON/OFF
- `SAVE`: 現在のループ保存
- `1B/2B/4B/8B/16B`: 指定長オートループ（再クリックでOFF）

### HOT CUE

- `1-4 / 5-8 / 9-12 / 13-16`: キューバンク切替
- 数字パッド: タップ1回でセット、もう1回で解除

### 右側ノブ

- `TEMPO (速度)`: `-75%` ～ `+75%`
- `KEY SHIFT (半音)`: ピッチを半音単位で変更

## ミキサー操作

### ラベルの意味

- `HI`: High EQ
- `MID`: Mid EQ
- `LOW`: Low EQ
- `FLT`: Tone Filter
- `DRM`: Drums ステム
- `INS`: Instruments ステム
- `VOC`: Vocals ステム
- `ECHO`: Echo量
- `RVB`: Reverb量
- `FX FLT`: FX Filter量

### チャンネル

- `VOCAL ECHO` / `DRUM FILTER`: Neural FX トグル
- `MUTE` / `SOLO` / `RESET`: チャンネル制御
- `MIX MACRO`: `BASS CUT`, `BRIGHT+`, `VOCAL FOCUS`, `DRUM FOCUS`
- `VOL`: チャンネル音量
- `VU`: 出力レベルメーター

### XY FX

- 左右A/Bそれぞれのパッドで同時操作
- X軸: Filter
- Y軸: Reverb
- ダブルクリック: センターにリセット

### クロスフェーダー

- 最下部 `A ↔ B` スライダー
- `A` 側で Deck A が強く、`B` 側で Deck B が強くなる

## ライブラリ操作

下部サイドバーは以下のビュー切替です。

- `Library`: 全トラック一覧
- `History`: デッキへのロード履歴
- `Playlists`: BPMベースのスマート分類
- `My Files`: 取り込み済みファイル一覧
- `Downloaded`: ローカルキャッシュ扱い一覧
- `Neural Mix`: 各デッキのステム状態

共通操作:

- 検索ボックス: `Library / My Files / Downloaded` で有効
- 曲の `A/B/C/D` ボタン: 対象デッキへロード
- ドラッグ&ドロップ: `Library` ビューの Drop 領域に音声ファイルを投下

## DJとしてのおすすめ運用

### セット開始前の準備

1. 使う候補曲を `Library` に取り込み、A/Bに2曲以上ロードして事前チェック
2. `WAVE: H` で全体構成確認、細かいキュー作業時だけ `WAVE: V` に切替
3. 各曲で `HOT CUE` を最低3点打つ
4. `VOL` を上げすぎず、`VU` が常時振り切れないように調整

### 安定してつなぐ基本フロー

1. 再生中デッキを基準に、次曲デッキで `SYNC`
2. 必要な場合のみ `KEY MATCH`（不自然に感じたら戻す）
3. 先に次曲の `LOW` を少し下げる
4. クロスフェーダーを8〜16小節でゆっくり移動
5. 切替完了後、前曲側の `LOW`/`FX` を戻して次の準備

### ミスしにくい設定のコツ

- `XFADE: SMOOTH`: 通常運用向け
- `XFADE: POWER`: ドロップを強調したい時
- `XFADE: NEURAL`: ボーカル/ドラムを分けた演出ミックス向け
- 長時間プレイは `REC START` で常時録音して保険をかける

## 実戦マニュアル（シーン別）

### 1. オープニング（ウォームアップ）

1. BPM差が小さい曲同士で開始
2. `BASS CUT` を使い、低域の濁りを抑えて導入
3. `RVB` を軽く足して空間を作る

### 2. サビ前のビルドアップ

1. 次曲を `PLAY` して `VOL` を低めで待機
2. `FX FLT` か XY PAD のX軸で徐々に帯域を絞る
3. 直前でクロスフェーダーをセンターへ寄せる

### 3. ドロップ切替

1. `AUTO DROP` を使うか、手動で一気にクロスフェード
2. ドロップ時は `POWER` か `DRUM FOCUS` が有効
3. 切替後に不要FXをオフ、`RESET` でチャンネル整形

### 4. ボーカル被り回避

1. 片側の `VOC` を下げる
2. もう片側は `VOCAL FOCUS` か `VOCAL ECHO` を使う
3. 2〜4小節で主役ボーカルを入れ替える

### 5. 緊急リカバリー（ズレた/濁った）

1. いったん `LOW` をどちらか片側だけ残す
2. 位相感が悪い時は `KEY MATCH` を解除し再確認
3. 危ない時は `LOOP` 4Bで時間を作って立て直す

## MIDI Learn

割当可能な主なターゲット:

- `Play/Cue/Sync/KeyMatch` (A/B)
- `Crossfader`
- `Volume/Tempo/Filter` (A/B)
- `Stem Vocal/Drums/Instruments` (A/B)

手順:

1. `MIDI CONNECT`
2. `Learn: ...` で対象選択
3. `MIDI LEARN`
4. コントローラー側でノブ/パッド操作

## 録音

- `REC START` で録音開始
- 再度押すと停止して自動ダウンロード
- ブラウザごとに対応コーデックが異なるため、出力拡張子は環境により変わります（`webm` / `m4a` など）

## トラブルシュート

### ボタンを押しても反応しない

- ハードリロード (`Shift + Reload`) を実行
- 開発サーバーを再起動

```bash
pkill -f vite
npm run dev
```

### Safari で音が出ない

- 画面を一度タップ/クリックしてから再生
- それでも無音なら、別タブで自動再生ブロックや出力先デバイス設定を確認

### 4 Deck が切り替わらない

- URL が古いサーバー (`:5174` など) になっていないか確認
- `http://localhost:5173` へアクセスし直す

## 補足

- Neural 分離はローカル推論のため、初回解析は重くなる場合があります
- `XFADE: NEURAL` は演出重視で、通常より遷移が長めです
