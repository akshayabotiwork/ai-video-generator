# AI News-Video Generator ⚡🎬

A generalized, automated Python-based AI News-Video creation platform that converts raw scripts into broadcast-quality news videos with intelligent scene segmentation, automated SERP API visual asset retrieval, TTS narration, synchronized subtitles, dynamic broadcast overlays (tickers, lower-thirds, badges), and FFmpeg compositing.

---

## 🌟 Key Features

1. **Intelligent Script Director & Segmenter**:
   - Analyzes raw script or news article across **News, Sports, Technology, Business, Politics, and History**.
   - Extracts Named Entities (e.g. *"Virat Kohli"*), actions (*"batting"*), opponents (*"England"*), and temporal anchors (*"2012"*).
2. **Context-Aware Visual Search via SERP API**:
   - Queries Google Images / Videos via SERP API using exact matching quotes and high-res photo filters.
   - Multi-factor relevance ranker weighting entity presence, temporal year match, and trusted editorial domains (ESPNcricinfo, Reuters, AP, Bloomberg, BBC, etc.).
   - Built-in fallback to high-quality public editorial archives (Wikimedia Commons) and procedural broadcast title cards.
3. **Multi-Lingual TTS Narration & Subtitle Sync**:
   - Powered by `edge-tts` with broadcast neural voices across English (US/UK), Hindi, and Gujarati.
   - Generates millisecond-accurate word boundaries and formatted `.ass` broadcast subtitles.
4. **Professional News Broadcast Overlays & Motion**:
   - Dynamic two-tier Lower-Third headline strap.
   - Animated news ticker tape & live broadcast bug badge.
   - 60fps Ken Burns pan & zoom motion engine.
   - Smart aspect ratio adaptation (`16:9` Landscape or `9:16` Portrait for Shorts/Reels) with blurred backdrop fill.
5. **Interactive Full-Stack Web Studio**:
   - Interactive Storyboard with scene preview, inline text editing, and live SERP API search/swap modal.
   - Real-time rendering progress monitor and embedded 1080p video player with one-click download.

---

## 🚀 Quick Start

### 1. Configure Environment Variables
Copy `.env.example` to `.env` and optionally set your API keys:
```bash
cp .env.example .env
```
Inside `.env`:
```ini
SERPAPI_API_KEY=your_serpapi_key_here
GEMINI_API_KEY=your_gemini_api_key_here
OPENAI_API_KEY=your_openai_api_key_here
```
*(Note: If no API keys are provided, the system automatically uses its built-in rule-based contextual parser and Wikimedia Commons archives for zero-cost operation).*

### 2. Run Web Studio
```bash
python app.py
```
Open your browser at **`http://localhost:8000`**.

### 3. Run Command-Line Pipeline Test
```bash
python test_pipeline.py
```

---

## 🏗️ Architecture & Modules

```
ai image video arranger/
├── app.py                          # FastAPI Server & Web Studio Endpoints
├── config.py                       # Settings, FFmpeg Detection, Themes & Voice Options
├── test_pipeline.py                # Automated End-to-End Pipeline Test
├── core/
│   ├── models.py                   # Pydantic Schemas (SceneData, VisualCandidate, VideoProject)
│   ├── director.py                 # LLM / Semantic Heuristic Script Segmenter
│   ├── serp_searcher.py            # SERP API Visual Discovery & Multi-Factor Context Ranker
│   ├── media_downloader.py         # Async Media Fetcher, PIL Validator & Fallback Cards
│   ├── tts_engine.py               # Edge-TTS Narration & Subtitle Timestamps
│   ├── subtitle_styler.py          # ASS/SRT Subtitle Generator with News Styling
│   ├── graphics_generator.py       # News Overlays (Lower-Thirds, Badges, Tickers)
│   ├── audio_mixer.py              # Soundbed Manager & Audio Ducking Mixer
│   ├── video_composer.py           # FFmpeg Filter Complex Renderer (Ken Burns & Overlays)
│   └── pipeline.py                 # Master Orchestration Pipeline
└── web_studio/                     # Frontend Studio UI (HTML/CSS/JS)
```
