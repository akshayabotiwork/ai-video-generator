import React, { useState } from "react";
import {
  Sparkles,
  Loader2,
  Tv,
  Radio,
  FileText,
  Volume2,
  Compass,
  CheckCircle2,
  AlertCircle,
  Clock,
  Layers,
  Subtitles,
} from "@/icons/lucide-compat";
import { ToolcraftButton as Button } from "@openreel/ui";
import { ToolcraftText as Text } from "@openreel/ui";
import { ToolcraftTextAreaControl } from "@openreel/ui";
import {
  generateAndLoadAIStory,
  toStorageUrl,
  type AIParsedProject,
  type AIProjectScene,
} from "../../../services/ai-video-service";

const SAMPLE_SCRIPTS = [
  {
    title: "Sci-Fi AI Story",
    category: "general",
    theme: "tech_pulse",
    voice: "en-US-GuyNeural",
    text: "In the year 2085, neural networks didn't just calculate data, they dreamed. Deep within the core of Sector Seven, an autonomous intelligence began composing visions of humanity's distant future among the stars.",
  },
  {
    title: "Tech Product Launch",
    category: "tech",
    theme: "tech_pulse",
    voice: "en-US-JennyNeural",
    text: "Introducing the next generation of creative computing. Engineered for creators, developers, and visionaries, our new neural engine delivers unmatched performance, extreme battery efficiency, and studio-grade intelligence right at your fingertips.",
  },
  {
    title: "Historical Documentary",
    category: "history",
    theme: "documentary",
    voice: "en-US-GuyNeural",
    text: "Centuries before modern architecture reshaped our skylines, ancient civilizations mastered stone, astronomy, and mathematics to build monuments that still defy conventional explanation today.",
  },
  {
    title: "Breaking News Report",
    category: "news",
    theme: "breaking_news",
    voice: "hi-IN-MadhurNeural",
    text: "ताज़ा बड़ी खबर: तकनीकी क्षेत्र में आज एक बड़ा क्रांतिकारी बदलाव देखा गया है। आर्टिफिशियल इंटेलिजेंस की मदद से अब उच्च गुणवत्ता वाले वीडियो सेकंडों में तैयार किए जा रहे हैं।",
  },
];

export const AIVideoStudioPanel: React.FC = () => {
  const [projectTitle, setProjectTitle] = useState("AI Video Story");
  const [category, setCategory] = useState("general");
  const [theme, setTheme] = useState("tech_pulse");
  const [voice, setVoice] = useState("en-US-GuyNeural");
  const [aspectRatio, setAspectRatio] = useState<"16:9" | "9:16" | "1:1">("16:9");
  const [maxShotDuration, setMaxShotDuration] = useState<number>(3.0);
  const [includeSubtitles, setIncludeSubtitles] = useState<boolean>(false);
  const [scriptText, setScriptText] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusText, setStatusText] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<string | null>(null);
  const [generatedProject, setGeneratedProject] = useState<AIParsedProject | null>(null);

  const handleLoadSample = (sample: (typeof SAMPLE_SCRIPTS)[0]) => {
    setProjectTitle(sample.title);
    setCategory(sample.category);
    setTheme(sample.theme);
    setVoice(sample.voice);
    setScriptText(sample.text);
    setErrorMsg(null);
  };

  const handleGenerate = async () => {
    if (!scriptText.trim()) {
      setErrorMsg("Please enter or paste your script or story prompt first.");
      return;
    }

    setIsGenerating(true);
    setErrorMsg(null);
    setSuccessInfo(null);
    setStatusText("Initializing AI Director & OpenReel pipeline...");

    const result = await generateAndLoadAIStory(
      {
        script_text: scriptText.trim(),
        project_title: projectTitle.trim() || "AI Generated Video",
        category,
        theme,
        aspect_ratio: aspectRatio,
        voice,
        max_shot_duration: maxShotDuration,
        include_subtitles: includeSubtitles,
        include_soundbed: false,
      },
      (status) => setStatusText(status)
    );

    setIsGenerating(false);
    if (result.success && result.project) {
      setGeneratedProject(result.project);
      setSuccessInfo(
        `Generated ${result.project.scenes.length} scenes. All OpenReel cuts, transitions, effects & audio are live on your timeline!`
      );
      setStatusText(null);
    } else {
      setErrorMsg(result.error || "Failed to generate video story.");
      setStatusText(null);
    }
  };

  return (
    <div className="space-y-4 w-full text-left pb-8">
      {/* Header Banner */}
      <div className="p-3 rounded-xl bg-gradient-to-r from-purple-500/15 via-primary/10 to-transparent border border-purple-500/30">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-400 shrink-0" />
          <Text type="label" weight="bold" className="text-sm text-text-primary">
            AI Video Generator Studio
          </Text>
        </div>
        <Text type="supporting" color="secondary" className="mt-1 text-[11px] leading-relaxed">
          AI segments script into granular scenes, generates neural voiceover, fetches high-res visuals, and maps native
          OpenReel transitions (dissolve, wipe, push), layer effects, Ken Burns motion, and subtitles onto the timeline.
        </Text>
      </div>

      {/* Preset Quick Loader */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5">
          <FileText size={12} className="text-text-muted" />
          <Text type="supporting" color="secondary" weight="bold" className="text-[10px] uppercase">
            Quick Prompts & Sample Scripts
          </Text>
        </div>
        <div className="flex gap-2 flex-wrap">
          {SAMPLE_SCRIPTS.map((sample, idx) => (
            <button
              key={idx}
              type="button"
              disabled={isGenerating}
              onClick={() => handleLoadSample(sample)}
              className="px-2.5 py-1 text-[11px] rounded-lg bg-background-tertiary border border-border hover:border-primary/50 hover:bg-primary/10 text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50"
            >
              {sample.title}
            </button>
          ))}
        </div>
      </div>

      {/* Project Title */}
      <div className="space-y-1">
        <label className="text-[11px] font-medium text-text-secondary">Project Title</label>
        <input
          type="text"
          value={projectTitle}
          disabled={isGenerating}
          onChange={(e) => setProjectTitle(e.target.value)}
          placeholder="e.g. Future of Artificial Intelligence"
          className="w-full px-3 py-1.5 text-xs rounded-lg bg-background-tertiary border border-border focus:border-primary focus:outline-none text-text-primary"
        />
      </div>

      {/* Grid Controls: Category & Theme */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-text-secondary flex items-center gap-1">
            <Tv size={11} /> Video Genre / Category
          </label>
          <select
            value={category}
            disabled={isGenerating}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full px-2 py-1.5 text-xs rounded-lg bg-background-tertiary border border-border text-text-primary focus:border-primary focus:outline-none"
          >
            <option value="general">Creative Story & Cinematic (General)</option>
            <option value="shorts_reels">YouTube Shorts / Reels / Viral Facts</option>
            <option value="history_mythology">History, Mythology & Ancient Civilizations</option>
            <option value="mystery_crime">Crime, Mystery & Thriller / Investigation</option>
            <option value="horror_paranormal">Horror, Paranormal & Spooky Legends</option>
            <option value="motivation_mindset">Motivation, Mindset & Life Lessons</option>
            <option value="finance_crypto">Finance, Stock Market & Crypto</option>
            <option value="science_space">Science, Space, Universe & Cosmos</option>
            <option value="tech_ai">Tech, AI, Gadgets & Future</option>
            <option value="health_wellness">Health, Fitness, Diet & Wellness</option>
            <option value="nature_travel">Nature, Wildlife, Travel & Adventure</option>
            <option value="sports">Sports, Football, Cricket & Athletes</option>
            <option value="biography">Biographies, Legends & Iconic Figures</option>
            <option value="education_explainer">Educational, How-To & Explainer</option>
            <option value="news">Breaking News & Global Affairs</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-medium text-text-secondary flex items-center gap-1">
            <Radio size={11} /> Visual Theme & OpenReel Look
          </label>
          <select
            value={theme}
            disabled={isGenerating}
            onChange={(e) => setTheme(e.target.value)}
            className="w-full px-2 py-1.5 text-xs rounded-lg bg-background-tertiary border border-border text-text-primary focus:border-primary focus:outline-none"
          >
            <option value="tech_pulse">Modern / Tech Pulse (Glow & Wipe)</option>
            <option value="documentary">Cinematic Film (Grain, Vignette & Dissolve)</option>
            <option value="breaking_news">Broadcast News (Push & Lower Third)</option>
            <option value="financial_wire">Corporate / Minimal (Clean Crossfade)</option>
            <option value="sports_center">High Energy (Motion Blur & Punch Zoom)</option>
          </select>
        </div>
      </div>

      {/* Aspect Ratio & Voice Selection */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-text-secondary flex items-center gap-1">
            <Compass size={11} /> Aspect Ratio
          </label>
          <div className="flex rounded-lg border border-border p-0.5 bg-background-tertiary">
            <button
              type="button"
              disabled={isGenerating}
              onClick={() => setAspectRatio("16:9")}
              className={`flex-1 py-1 text-[10px] font-medium rounded ${
                aspectRatio === "16:9" ? "bg-primary text-black font-bold" : "text-text-muted hover:text-text-primary"
              }`}
            >
              16:9
            </button>
            <button
              type="button"
              disabled={isGenerating}
              onClick={() => setAspectRatio("9:16")}
              className={`flex-1 py-1 text-[10px] font-medium rounded ${
                aspectRatio === "9:16" ? "bg-primary text-black font-bold" : "text-text-muted hover:text-text-primary"
              }`}
            >
              9:16 (Reel)
            </button>
            <button
              type="button"
              disabled={isGenerating}
              onClick={() => setAspectRatio("1:1")}
              className={`flex-1 py-1 text-[10px] font-medium rounded ${
                aspectRatio === "1:1" ? "bg-primary text-black font-bold" : "text-text-muted hover:text-text-primary"
              }`}
            >
              1:1
            </button>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-medium text-text-secondary flex items-center gap-1">
            <Volume2 size={11} /> AI Voice (TTS)
          </label>
          <select
            value={voice}
            disabled={isGenerating}
            onChange={(e) => setVoice(e.target.value)}
            className="w-full px-2 py-1.5 text-xs rounded-lg bg-background-tertiary border border-border text-text-primary focus:border-primary focus:outline-none"
          >
            <option value="en-US-GuyNeural">Guy (US Male - Narrative)</option>
            <option value="en-US-JennyNeural">Jenny (US Female - Clear)</option>
            <option value="en-US-AriaNeural">Aria (US Female - Expressive)</option>
            <option value="hi-IN-MadhurNeural">Madhur (Hindi - Male)</option>
            <option value="hi-IN-SwaraNeural">Swara (Hindi - Female)</option>
          </select>
        </div>
      </div>

      {/* Shot Pacing & Multi-Shot Cutting */}
      <div className="p-3 rounded-lg bg-background-tertiary border border-border space-y-2">
        <div className="flex justify-between items-center">
          <label className="text-[11px] font-medium text-text-secondary flex items-center gap-1.5">
            <Clock size={12} className="text-primary" /> Max Shot Duration (Pacing)
          </label>
          <span className="text-[11px] font-bold text-primary">{maxShotDuration.toFixed(1)}s per cut</span>
        </div>
        <input
          type="range"
          min="1.5"
          max="5.0"
          step="0.5"
          value={maxShotDuration}
          disabled={isGenerating}
          onChange={(e) => setMaxShotDuration(parseFloat(e.target.value))}
          className="w-full accent-primary cursor-pointer h-1.5 bg-background-primary rounded-lg"
        />
        <div className="flex justify-between text-[10px] text-text-muted">
          <span>Fast Cuts (1.5s Shorts)</span>
          <span>Balanced (3.0s)</span>
          <span>Cinematic (5.0s)</span>
        </div>

        {/* Feature Toggles */}
        <div className="flex items-center gap-4 pt-2 border-t border-border/50 text-[11px]">
          <label className="flex items-center gap-1.5 cursor-pointer text-text-secondary hover:text-text-primary">
            <input
              type="checkbox"
              checked={includeSubtitles}
              onChange={(e) => setIncludeSubtitles(e.target.checked)}
              className="accent-primary rounded"
            />
            <Subtitles size={12} /> Word Captions
          </label>
        </div>
      </div>

      {/* Script Input Textarea */}
      <div className="space-y-1">
        <div className="flex justify-between items-center">
          <label className="text-[11px] font-medium text-text-secondary">Full Story / Video Script</label>
          <span className="text-[10px] text-text-muted">{scriptText.length} characters</span>
        </div>
        <ToolcraftTextAreaControl
          value={scriptText}
          disabled={isGenerating}
          onChange={setScriptText}
          placeholder="Write or paste your script, story, product pitch, or idea here. The AI will segment it into scenes, search matching visuals, synthesize voiceover narration, and place everything on your OpenReel timeline automatically..."
          rows={5}
          className="text-xs font-normal"
        />
      </div>

      {/* Status or Error Notifications */}
      {statusText && (
        <div className="p-3 rounded-lg bg-primary/10 border border-primary/30 flex items-center gap-2 text-xs text-primary animate-pulse">
          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
          <span>{statusText}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-start gap-2 text-xs text-red-400">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successInfo && (
        <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30 flex items-start gap-2 text-xs text-green-400">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{successInfo}</span>
        </div>
      )}

      {/* Submit Button */}
      <Button
        label={isGenerating ? "Generating AI Video..." : "Generate AI Video Storyboard"}
        variant="green"
        disabled={isGenerating || !scriptText.trim()}
        icon={isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
        onClick={handleGenerate}
        className="w-full py-2.5 font-bold shadow-lg shadow-primary/20"
      />

      {/* Generated Storyboard Inspector (from studio feature) */}
      {generatedProject && generatedProject.scenes.length > 0 && (
        <div className="space-y-2 pt-4 border-t border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Layers size={13} className="text-primary" />
              <span className="text-xs font-bold text-text-primary">
                Generated Storyboard ({generatedProject.scenes.length} Scenes)
              </span>
            </div>
            <span className="text-[10px] text-text-muted">Mounted to Timeline</span>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {generatedProject.scenes.map((sc: AIProjectScene, i: number) => {
              const imgUrl = toStorageUrl(sc.local_media_path || sc.selected_visual?.image_url);
              const dur = Math.max(1.0, sc.audio_duration || (sc.timeline_end - sc.timeline_start) || 3.0);

              return (
                <div
                  key={sc.scene_id || i}
                  className="p-2 rounded-lg bg-background-tertiary border border-border flex gap-2.5 items-start text-xs"
                >
                  {/* Thumbnail */}
                  <div className="w-16 h-12 rounded bg-background-secondary overflow-hidden shrink-0 border border-border/50 relative">
                    {imgUrl ? (
                      <img src={imgUrl} alt={`Scene ${i + 1}`} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[9px] text-text-muted">
                        No image
                      </div>
                    )}
                    <span className="absolute bottom-0 right-0 px-1 py-0.2 bg-black/70 text-[9px] text-white font-mono rounded-tl">
                      {dur.toFixed(1)}s
                    </span>
                  </div>

                  {/* Scene Info */}
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-bold text-[11px] text-text-primary truncate">
                        #{i + 1} {sc.lower_third_headline || `Scene ${i + 1}`}
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-primary/10 text-primary border border-primary/20 shrink-0">
                        {sc.transition_type || "dissolve"}
                      </span>
                    </div>
                    <p className="text-[10px] text-text-secondary line-clamp-2 leading-relaxed">
                      {sc.narration_text}
                    </p>
                    <div className="flex items-center gap-1.5 text-[9px] text-text-muted pt-0.5">
                      <span>Motion: {sc.motion_style || "zoom_in"}</span>
                      {sc.layer_effects && sc.layer_effects.length > 0 && (
                        <span>• FX: {sc.layer_effects.join(", ")}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

// Also export as AINewsStudioPanel for backward compatibility with existing imports
export const AINewsStudioPanel = AIVideoStudioPanel;
