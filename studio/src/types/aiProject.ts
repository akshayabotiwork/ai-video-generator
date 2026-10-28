export interface VisualCandidate {
  title: string
  source: string
  link?: string
  image_url: string
  thumbnail_url: string
  width?: number
  height?: number
  relevance_score?: number
  matched_entity?: string
  is_video?: boolean
}

export interface WordTimestamp {
  word: string
  start: number
  end: number
}

export interface SceneData {
  scene_id: number
  narration_text: string
  primary_entity?: string
  action?: string
  opponent_or_context?: string
  temporal_anchor?: string
  search_query: string
  secondary_queries?: string[]
  visual_type_preference?: 'image' | 'video' | 'auto'
  lower_third_headline?: string
  category_tag?: string
  visual_category?: 'character_portrait' | 'dynamic_action' | 'symbolic_metaphor' | 'wide_environment' | 'artifact_detail' | string
  focal_point?: 'top_face' | 'center' | 'wide_horizon' | string
  motion_style: 'zoom_in' | 'zoom_out' | 'pan_left' | 'pan_right' | 'static' | string
  motion_speed?: 'slow_dramatic' | 'fast_punch' | 'steady_pan' | string
  chapter_marker?: string
  transition_type: string
  transition_duration: number
  timeline_start: number
  timeline_end: number
  word_timestamps?: WordTimestamp[]
  selected_visual?: VisualCandidate | null
  visual_candidates?: VisualCandidate[]
  local_media_path?: string | null
  all_media_paths?: string[]
  local_audio_path?: string | null
  audio_duration?: number
}

export interface VideoProject {
  project_id: string
  title: string
  raw_script: string
  category: string
  theme: string
  aspect_ratio: '16:9' | '9:16' | '1:1'
  voice: string
  default_transition: string
  transition_duration: number
  max_shot_duration: number
  total_timeline_duration: number
  include_subtitles: boolean
  include_ticker: boolean
  include_background_music: boolean
  master_audio_path?: string | null
  scenes: SceneData[]
  output_video_path?: string | null
  status: 'draft' | 'parsed' | 'media_selected' | 'rendering' | 'completed' | 'failed'
  error_message?: string | null
  progress_percent: number
}

export interface SystemLogEntry {
  id: number
  timestamp: string
  level: 'INFO' | 'SUCCESS' | 'WARN' | 'ERROR'
  source: string
  message: string
  details?: any
}

export const SCRIPT_PRESETS: { id: string; label: string; title: string; category: string; theme: string; voice: string; script: string }[] = [
  {
    id: 'hindi_cricket',
    label: '🏏 भारत vs WI (Hindi)',
    title: 'भारत की वेस्टइंडीज पर ऐतिहासिक 5 विकेट से जीत',
    category: 'sports',
    theme: 'sports_center',
    voice: 'hi-IN-MadhurNeural',
    script: 'कल शाम बारबाडोस में खेले गए पहले रोमांचक वनडे मैच में, भारतीय क्रिकेट टीम ने वेस्टइंडीज को 5 विकेट से धूल चटा दी। कुलदीप यादव ने अपनी फिरकी का ऐसा जादू चलाया कि विरोधी टीम के चार मुख्य बल्लेबाज टिक न सके। इसके बाद कप्तान रोहित शर्मा और ईशान किशन की विस्फोटक साझेदारी ने मुकाबला भारत की झोली में डाल दिया। यह 2024 सीजन की शुरुआत का सबसे यादगार और आक्रामक मुकाबला साबित हुआ।'
  },
  {
    id: 'sports_kohli',
    label: '🏏 Kohli Hobart 2012',
    title: 'Virat Kohli 133 vs Sri Lanka Hobart 2012',
    category: 'sports',
    theme: 'sports_center',
    voice: 'en-US-GuyNeural',
    script: 'In February 2012 at Hobart, Virat Kohli delivered one of the greatest run chases in cricket history. Needing 321 runs inside 40 overs for a bonus point, Kohli dismantled the Sri Lankan attack with a blistering 133 not out from just 86 balls. His assault on Lasith Malinga in the 35th over remains legendary, reaching the target in just 36.4 overs in sensational style.'
  },
  {
    id: 'tech_quantum',
    label: '🤖 Quantum AI 2026',
    title: 'Quantum AI Quantum Supremacy Breakthrough',
    category: 'tech',
    theme: 'tech_pulse',
    voice: 'en-US-AriaNeural',
    script: 'Tech researchers have officially unveiled the next frontier in quantum machine learning. The newly demonstrated processor resolves complex molecular simulations in seconds that would take classical supercomputers decades. Industry experts predict this milestone will accelerate clean energy catalysts and generative AI reasoning capabilities worldwide.'
  },
  {
    id: 'breaking_geneva',
    label: '🌍 Geneva Summit',
    title: 'Geneva Global Climate Resilience Treaty',
    category: 'news',
    theme: 'breaking_news',
    voice: 'en-US-GuyNeural',
    script: 'Diplomats from 140 countries have reached an unprecedented pact at the Geneva Climate Summit today. The agreement establishes a unified renewable energy fund alongside strict industrial emissions targets for the coming decade. Leaders hailed the accord as a historic breakthrough for international environmental governance.'
  }
]
