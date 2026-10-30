// SCRIPT PRESETS
const SCRIPT_PRESETS = {
  hindi_cricket: {
    title: "India vs WI 1st ODI Historic Win",
    category: "sports",
    theme: "sports_center",
    voice: "hi-IN-MadhurNeural",
    script: "भारत ने वेस्टइंडीज के खिलाफ पहले वनडे में शानदार जीत दर्ज की। विराट कोहली ने नाबाद 139 रनों की तूफानी पारी खेली, जबकि शुभमन गिल ने भी शतक जड़कर टीम को मजबूत शुरुआत दी। गेंदबाजों ने शानदार प्रदर्शन किया और भारत ने मुकाबला 8 विकेट से जीतकर सीरीज में बढ़त बनाई।"
  },
  sports: {
    title: "Virat Kohli 2012 Historic Masterclass",
    category: "sports",
    theme: "sports_center",
    voice: "hi-IN-MadhurNeural",
    script: "In a historic 2012 cricket showdown, Virat Kohli produced a masterclass batting performance against England.\nThe dynamic Indian batsman dominated the English bowling attack with pinpoint precision and aggressive stroke play.\nThis iconic innings cemented his reputation as one of the modern era's greatest match-winners in world cricket."
  },
  tech: {
    title: "Next-Gen Quantum AI Architecture Unveiled",
    category: "tech",
    theme: "tech_pulse",
    voice: "en-US-GuyNeural",
    script: "Tech researchers have officially unveiled a breakthrough quantum computing chip capable of exponential AI model training.\nIndustry leaders at OpenAI and Google announced that this architecture slashes datacenter power consumption by ninety percent.\nThe global technological landscape stands on the threshold of a massive paradigm shift in artificial intelligence."
  },
  breaking: {
    title: "Global Climate Summit Keynote Announcement",
    category: "news",
    theme: "breaking_news",
    voice: "en-US-AriaNeural",
    script: "Breaking News: World leaders have convened in Geneva for an emergency bilateral summit on renewable infrastructure.\nA landmark eighty billion dollar fund was unanimously ratified to accelerate solar and green hydrogen power grids.\nInternational delegates praised the agreement as the most aggressive environmental pact signed this decade."
  }
};

const TRANSITIONS_LIST = [
  { id: "fade", name: "Crossfade (fade)" },
  { id: "slideleft", name: "Slide Left" },
  { id: "slideright", name: "Slide Right" },
  { id: "wipeleft", name: "Wipe Left" },
  { id: "wiperight", name: "Wipe Right" },
  { id: "smoothleft", name: "Smooth Push Left" },
  { id: "circlecrop", name: "Circle Iris" },
  { id: "dissolve", name: "Dissolve Grain" },
  { id: "radial", name: "Radial Sweep" },
  { id: "zoomin", name: "Zoom In Cut" }
];

// App State
let currentProject = null;
let activeSceneId = 1;
let currentModalSceneId = null;
let statusPollInterval = null;
let isPlayingPreview = false;
let previewPlayTimer = null;
let currentPlayheadTime = 0.0;
let timelineZoomFactor = 1.0;

// Initialize Editor on Load
document.addEventListener("DOMContentLoaded", () => {
  SystemLogs.init();
  loadScriptPreset("hindi_cricket");
  initSystemConfig();
});

async function initSystemConfig() {
  try {
    const resp = await fetch("/api/config");
    if (!resp.ok) return;
    const cfg = await resp.json();
    const defaultInterval = cfg.max_scene_interval || (cfg.motion_config && cfg.motion_config.max_shot_duration) || 3.0;
    const slider = document.getElementById("maxShotDurationSlider");
    const label = document.getElementById("maxShotDurationValueLabel");
    if (slider) slider.value = defaultInterval;
    if (label) label.innerText = `${defaultInterval}s`;
    SystemLogs.addLog("INFO", "SYSTEM", "Loaded studio engine configuration (/api/config)");
  } catch (e) {
    console.warn("Could not load /api/config:", e);
  }
}

function loadScriptPreset(key) {
  const p = SCRIPT_PRESETS[key];
  if (!p) return;

  document.getElementById("projectTitle").value = p.title;
  document.getElementById("categorySelect").value = p.category;
  document.getElementById("themeSelect").value = p.theme;
  document.getElementById("voiceSelect").value = p.voice;
  document.getElementById("scriptText").value = p.script;

  if (typeof SystemLogs !== "undefined" && SystemLogs.addLog) {
    SystemLogs.addLog("INFO", "STUDIO-UI", `Loaded preset: "${p.title}" (${p.category} / ${p.theme})`);
  }
}

// Sidebar Tab Switcher
function switchSidebarTab(tabId) {
  document.querySelectorAll(".side-tab-btn").forEach(b => b.classList.remove("active"));
  document.querySelectorAll(".sidebar-pane").forEach(p => p.classList.remove("active"));

  const targetBtn = document.getElementById(`tabNav${tabId.charAt(0).toUpperCase() + tabId.slice(1)}`);
  const targetPane = document.getElementById(`pane${tabId.charAt(0).toUpperCase() + tabId.slice(1)}`);

  if (targetBtn) targetBtn.classList.add("active");
  if (targetPane) targetPane.classList.add("active");
}

// Aspect Ratio Switcher
function setAspectRatio(ratio) {
  document.getElementById("aspectRatioSelect").value = ratio;
  document.getElementById("btnAspect169").classList.toggle("active", ratio === "16:9");
  document.getElementById("btnAspect916").classList.toggle("active", ratio === "9:16");

  const monitorScreen = document.getElementById("monitorScreen");
  monitorScreen.classList.toggle("aspect-916", ratio === "9:16");
}

// Timecode Formatter: MM:SS.cs
function formatTimecode(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const centis = Math.floor((seconds % 1) * 100);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${centis.toString().padStart(2, '0')}`;
}

// Step 1: Parse Script into Storyboard & Generate Continuous Timeline
async function handleParseScript() {
  const scriptText = document.getElementById("scriptText").value.trim();
  const projectTitle = document.getElementById("projectTitle").value.trim() || "News Video Project";
  const category = document.getElementById("categorySelect").value;
  const theme = document.getElementById("themeSelect").value;
  const aspectRatio = document.getElementById("aspectRatioSelect").value;
  const voice = document.getElementById("voiceSelect").value;
  const serpKey = document.getElementById("serpApiKey").value.trim();

  if (!scriptText) {
    alert("Please enter a news script.");
    return;
  }

  const parseBtn = document.getElementById("parseScriptBtn");
  parseBtn.disabled = true;
  parseBtn.innerHTML = `<span>⏳</span> AI Parsing & Synthesizing Continuous Audio...`;

  const maxShotDurationSlider = document.getElementById("maxShotDurationSlider");
  const maxShotDuration = maxShotDurationSlider ? parseFloat(maxShotDurationSlider.value) : 3.0;

  SystemLogs.addLog("INFO", "DIRECTOR", `Initiating script breakdown: "${projectTitle}" (${category}, ${theme}, ${voice})`);
  SystemLogs.open();
  const livePollTimer = setInterval(() => {
    SystemLogs.fetchBackendLogs();
  }, 400);

  try {
    const resp = await fetch("/api/parse-script", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        script_text: scriptText,
        project_title: projectTitle,
        category: category,
        theme: theme,
        aspect_ratio: aspectRatio,
        voice: voice,
        serp_api_key: serpKey,
        max_shot_duration: maxShotDuration
      })
    });

    const data = await resp.json();
    if (!data.success) {
      SystemLogs.addLog("ERROR", "DIRECTOR", `Script parsing failed: ${data.detail || "Error generating storyboard"}`);
      alert("Parsing failed: " + (data.detail || "Error generating storyboard"));
      return;
    }

    currentProject = data.project;
    activeSceneId = currentProject.scenes[0] ? currentProject.scenes[0].scene_id : 1;

    SystemLogs.addLog(
      "SUCCESS",
      "DIRECTOR",
      `Storyboard generated with ${currentProject.scenes.length} scenes. Master voiceover duration: ${(currentProject.total_timeline_duration || 0).toFixed(1)}s`
    );

    renderNLETimeline();
    renderMediaBin();
    updateLiveMonitorPreview();
    switchSidebarTab("media");
  } catch (err) {
    SystemLogs.addLog("ERROR", "DIRECTOR", `Network or server error during parsing: ${err.message}`);
    alert("Network error: " + err.message);
  } finally {
    clearInterval(livePollTimer);
    await SystemLogs.fetchBackendLogs();
    parseBtn.disabled = false;
    parseBtn.innerHTML = `<span>✨</span> Generate Storyboard & Timeline`;
  }
}

// Render the Pro Multi-Track NLE Timeline
function renderNLETimeline() {
  if (!currentProject || !currentProject.scenes) return;

  const totalDur = Math.max(currentProject.total_timeline_duration || 12.0, 1.0);
  const numScenes = currentProject.scenes.length;

  // Header info
  document.getElementById("tlTotalDuration").innerText = `⏱️ Total: ${totalDur.toFixed(1)}s`;
  document.getElementById("tlSceneCount").innerText = `🎬 ${numScenes} Clips`;
  document.getElementById("timecodeDisplay").innerText = `00:00.00 / ${formatTimecode(totalDur)}`;

  // Pixels per second based on zoom factor
  const pps = 45 * timelineZoomFactor;
  const totalTrackWidth = Math.max(Math.round(totalDur * pps), 920);

  // 1. Time Ruler
  const rulerEl = document.getElementById("editorTimeRuler");
  rulerEl.style.width = `${totalTrackWidth}px`;
  rulerEl.innerHTML = "";

  const stepSec = totalDur > 30 ? 5 : 2;
  for (let t = 0; t <= totalDur + stepSec; t += stepSec) {
    const tick = document.createElement("div");
    tick.className = "ruler-tick";
    tick.style.left = `${t * pps}px`;
    tick.innerText = `${t}s`;
    rulerEl.appendChild(tick);
  }

  // 2. Track Lanes
  const laneV1 = document.getElementById("laneVisuals");
  const laneV2 = document.getElementById("laneOverlays");
  const laneCC = document.getElementById("laneCaptions");
  const laneA1 = document.getElementById("laneVoiceover");
  const laneA2 = document.getElementById("laneMusic");

  laneV1.style.width = `${totalTrackWidth}px`;
  laneV2.style.width = `${totalTrackWidth}px`;
  laneCC.style.width = `${totalTrackWidth}px`;
  laneA1.style.width = `${totalTrackWidth}px`;
  laneA2.style.width = `${totalTrackWidth}px`;

  laneV1.innerHTML = "";
  laneV2.innerHTML = "";
  laneCC.innerHTML = "";
  laneA1.innerHTML = "";
  laneA2.innerHTML = "";

  // Render Visuals Track (V1) & Transitions
  currentProject.scenes.forEach((sc, idx) => {
    const isLast = (idx === numScenes - 1);
    const sceneDur = Math.max((sc.timeline_end - sc.timeline_start), 1.0);
    const clipPx = Math.round(sceneDur * pps);

    let previewUrl = "";
    if (sc.local_media_path) {
      const parts = sc.local_media_path.replace(/\\/g, "/").split("/storage/");
      if (parts.length > 1) previewUrl = "/storage/" + parts[1];
    }
    if (!previewUrl && sc.selected_visual) {
      previewUrl = sc.selected_visual.thumbnail_url || sc.selected_visual.image_url;
    }

    // Visual Clip (V1)
    const clipEl = document.createElement("div");
    clipEl.className = `nle-visual-clip ${sc.scene_id === activeSceneId ? 'active' : ''}`;
    clipEl.id = `nle-clip-${sc.scene_id}`;
    clipEl.style.width = `${clipPx}px`;
    clipEl.title = `Scene ${sc.scene_id}: ${sc.narration_text.substring(0, 30)}...`;
    clipEl.onclick = () => selectScene(sc.scene_id);
    clipEl.innerHTML = `
      <img src="${previewUrl || 'https://via.placeholder.com/300x160?text=Clip'}" alt="Scene ${sc.scene_id}">
      <span class="nle-clip-title">Scene ${sc.scene_id}</span>
      <span class="nle-clip-dur">${sceneDur.toFixed(1)}s</span>
    `;
    laneV1.appendChild(clipEl);

    // Transition Node between consecutive clips
    if (!isLast) {
      const transType = sc.transition_type || "fade";
      const transDur = sc.transition_duration || 0.5;
      const transNode = document.createElement("div");
      transNode.className = "nle-trans-node";
      transNode.title = `Transition to Scene ${idx + 2}: ${transType.toUpperCase()} (${transDur}s). Click to change.`;
      transNode.onclick = (e) => { e.stopPropagation(); cycleTransition(sc.scene_id); };
      transNode.innerHTML = `
        <span style="font-size:11px;">🔀</span>
        <span class="nle-trans-label">${transType}</span>
        <span class="nle-trans-dur">${transDur}s</span>
      `;
      laneV1.appendChild(transNode);
    }

    // Lower Third Overlay Block (V2)
    const overlayBlock = document.createElement("div");
    overlayBlock.className = "nle-overlay-block";
    overlayBlock.style.width = `${clipPx}px`;
    overlayBlock.title = `Lower Third: ${sc.lower_third_headline || 'NEWS BANNER'}`;
    overlayBlock.innerHTML = `🏷 ${sc.lower_third_headline || 'HEADLINE BANNER'}`;
    laneV2.appendChild(overlayBlock);

    if (!isLast) {
      const spacer = document.createElement("div");
      spacer.style.width = "64px";
      laneV2.appendChild(spacer);
    }

    // Subtitle Block (CC)
    const captionBlock = document.createElement("div");
    captionBlock.className = "nle-caption-block";
    captionBlock.style.width = `${clipPx}px`;
    captionBlock.title = `Subtitles: ${sc.narration_text}`;
    captionBlock.innerHTML = `💬 ${sc.narration_text.substring(0, 24)}...`;
    laneCC.appendChild(captionBlock);

    if (!isLast) {
      const spacer = document.createElement("div");
      spacer.style.width = "64px";
      laneCC.appendChild(spacer);
    }
  });

  // Track A1: SCENE AUDIO CLIPS
  currentProject.scenes.forEach((sc, idx) => {
    const isLast = idx === currentProject.scenes.length - 1;
    const dur = sc.audio_duration || (sc.timeline_end - sc.timeline_start) || 4;
    const clipPx = Math.max(Math.round(dur * PX_PER_SEC), 100);

    const audioBlock = document.createElement("div");
    audioBlock.className = "nle-master-audio-block";
    audioBlock.style.width = `${clipPx}px`;
    audioBlock.title = `Scene ${sc.scene_id} Audio (${dur.toFixed(1)}s)`;
    audioBlock.innerHTML = `
      <span style="font-size:11px; font-weight:700; white-space:nowrap; z-index:2;">🎙️ Scene ${sc.scene_id} VO</span>
      <span style="font-size:10px; font-family:var(--font-mono); z-index:2;">${dur.toFixed(1)}s</span>
    `;
    laneA1.appendChild(audioBlock);

    if (!isLast) {
      const spacer = document.createElement("div");
      spacer.style.width = "64px";
      laneA1.appendChild(spacer);
    }
  });

  // Track A2: Ambient Background Music Bed
  const musicBlock = document.createElement("div");
  musicBlock.className = "nle-music-block";
  musicBlock.style.width = `${totalTrackWidth - 20}px`;
  musicBlock.innerHTML = `🎵 Ambient Broadcast Soundbed (Auto Ducked under voiceover)`;
  laneA2.appendChild(musicBlock);
}

// Select an active scene to inspect and preview
function selectScene(sceneId) {
  activeSceneId = sceneId;
  const scene = currentProject.scenes.find(s => s.scene_id === sceneId);
  if (!scene) return;

  // Highlight timeline visual clip
  document.querySelectorAll(".nle-visual-clip").forEach(c => c.classList.remove("active"));
  const clipEl = document.getElementById(`nle-clip-${sceneId}`);
  if (clipEl) clipEl.classList.add("active");

  // Move scrubber to scene start
  movePlayheadTo(scene.timeline_start || 0);

  // Update Inspector Form Fields in Left Drawer
  document.getElementById("activeHeadlineInput").value = scene.lower_third_headline || "";
  document.getElementById("activeCategoryTagInput").value = scene.category_tag || "BREAKING";
  document.getElementById("activeSceneMotionSelect").value = scene.motion_style || "zoom_in";

  // Update Preview Screen Monitor
  updateLiveMonitorPreview();
}

// Move playhead line on timeline
function movePlayheadTo(seconds) {
  currentPlayheadTime = seconds;
  const pps = 45 * timelineZoomFactor;
  const playhead = document.getElementById("timelinePlayhead");
  playhead.style.left = `${80 + seconds * pps}px`;
  document.getElementById("scrubberClock").innerText = formatTimecode(seconds);
}

// Update the Live Monitor Preview Screen with active scene assets
function updateLiveMonitorPreview() {
  if (!currentProject || !currentProject.scenes) return;

  const scene = currentProject.scenes.find(s => s.scene_id === activeSceneId) || currentProject.scenes[0];
  if (!scene) return;

  let previewUrl = "";
  if (scene.local_media_path) {
    const parts = scene.local_media_path.replace(/\\/g, "/").split("/storage/");
    if (parts.length > 1) previewUrl = "/storage/" + parts[1];
  }
  if (!previewUrl && scene.selected_visual) {
    previewUrl = scene.selected_visual.thumbnail_url || scene.selected_visual.image_url;
  }

  const canvasImg = document.getElementById("previewCanvasImage");
  canvasImg.src = previewUrl || "https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?w=1280&q=80";

  // Simulate Ken Burns Motion Preview
  canvasImg.style.transform = (scene.motion_style === "zoom_out") ? "scale(1.05)" : "scale(1.15)";

  // Update Lower-Third Banner
  document.getElementById("simTagBadge").innerText = (scene.category_tag || "NEWS").toUpperCase();
  document.getElementById("simHeadlineText").innerText = (scene.lower_third_headline || "BREAKING NEWS").toUpperCase();

  // Update Subtitles
  document.getElementById("simSubtitlesText").innerText = scene.narration_text || "";

  // Update Monitor Status Bar
  document.getElementById("activeSceneBadge").innerText = `🎬 Scene ${scene.scene_id} of ${currentProject.scenes.length}`;
  document.getElementById("activeSceneTimeWindow").innerText = `⏱️ ${formatTimecode(scene.timeline_start || 0)} - ${formatTimecode(scene.timeline_end || 3)}`;
  document.getElementById("activeTransitionBadge").innerText = `🔀 ${scene.transition_type || 'fade'} (${scene.transition_duration || 0.5}s)`;
}

// Media Bin in Sidebar
function renderMediaBin() {
  if (!currentProject || !currentProject.scenes) return;

  const binGrid = document.getElementById("sidebarMediaGrid");
  binGrid.innerHTML = "";

  currentProject.scenes.forEach(sc => {
    let previewUrl = "";
    if (sc.local_media_path) {
      const parts = sc.local_media_path.replace(/\\/g, "/").split("/storage/");
      if (parts.length > 1) previewUrl = "/storage/" + parts[1];
    }
    if (!previewUrl && sc.selected_visual) {
      previewUrl = sc.selected_visual.thumbnail_url || sc.selected_visual.image_url;
    }

    const item = document.createElement("div");
    item.className = "media-bin-item";
    item.title = `Scene ${sc.scene_id}: Click to open search / swap`;
    item.onclick = () => openSerpModal(sc.scene_id);
    item.innerHTML = `
      <img src="${previewUrl || 'https://via.placeholder.com/200x120?text=Photo'}" alt="Scene ${sc.scene_id}">
      <div style="position:absolute; bottom:4px; left:6px; right:6px; display:flex; justify-content:space-between; z-index:2;">
        <span style="font-size:9px; font-weight:800; background:rgba(0,0,0,0.8); padding:1px 5px; border-radius:3px; color:#FFF;">Scene ${sc.scene_id}</span>
        <span style="font-size:9px; background:var(--accent-cyan); color:#000; padding:1px 4px; border-radius:3px; font-weight:700;">🔍 Swap</span>
      </div>
    `;
    binGrid.appendChild(item);
  });
}

// Cycle transition when clicking a transition badge on the timeline
async function cycleTransition(sceneId) {
  const scene = currentProject.scenes.find(s => s.scene_id === sceneId);
  if (!scene) return;

  const currentIdx = TRANSITIONS_LIST.findIndex(t => t.id === scene.transition_type);
  const nextIdx = (currentIdx + 1) % TRANSITIONS_LIST.length;
  scene.transition_type = TRANSITIONS_LIST[nextIdx].id;

  renderNLETimeline();
  updateLiveMonitorPreview();

  // Persist
  await fetch("/api/update-scene", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      project_id: currentProject.project_id,
      scene_id: sceneId,
      transition_type: scene.transition_type
    })
  });
}

// Active Scene Property Updates from Left Drawer
async function updateActiveSceneHeadline(newText) {
  if (!currentProject) return;
  const scene = currentProject.scenes.find(s => s.scene_id === activeSceneId);
  if (!scene) return;

  scene.lower_third_headline = newText.trim();
  document.getElementById("simHeadlineText").innerText = scene.lower_third_headline.toUpperCase() || "HEADLINE";
  renderNLETimeline();

  await fetch("/api/update-scene", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      project_id: currentProject.project_id,
      scene_id: activeSceneId,
      lower_third_headline: scene.lower_third_headline
    })
  });
}

async function updateActiveSceneTag(newTag) {
  if (!currentProject) return;
  const scene = currentProject.scenes.find(s => s.scene_id === activeSceneId);
  if (!scene) return;

  scene.category_tag = newTag.trim();
  document.getElementById("simTagBadge").innerText = scene.category_tag.toUpperCase() || "NEWS";

  await fetch("/api/update-scene", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      project_id: currentProject.project_id,
      scene_id: activeSceneId,
      category_tag: scene.category_tag
    })
  });
}

async function updateActiveSceneMotion(newMotion) {
  if (!currentProject) return;
  const scene = currentProject.scenes.find(s => s.scene_id === activeSceneId);
  if (!scene) return;

  scene.motion_style = newMotion;
  updateLiveMonitorPreview();

  await fetch("/api/update-scene", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      project_id: currentProject.project_id,
      scene_id: activeSceneId,
      motion_style: newMotion
    })
  });
}

function handleGlobalTransitionChange(val) {
  if (!currentProject || !currentProject.scenes) return;
  currentProject.default_transition = val;
  currentProject.scenes.forEach(s => s.transition_type = val);
  renderNLETimeline();
  updateLiveMonitorPreview();
}

function handleTransDurationSlider(val) {
  document.getElementById("transDurationValueLabel").innerText = `${val}s`;
  if (!currentProject || !currentProject.scenes) return;
  const d = parseFloat(val);
  currentProject.transition_duration = d;
  currentProject.scenes.forEach(s => s.transition_duration = d);
  renderNLETimeline();
  updateLiveMonitorPreview();
}

function handleMaxShotDurationSlider(val) {
  const d = parseFloat(val);
  const label = document.getElementById("maxShotDurationValueLabel");
  if (label) label.innerText = `${d}s`;
  if (currentProject) {
    currentProject.max_shot_duration = d;
  }
}

// Adjust Timeline Zoom
function adjustTimelineZoom(delta) {
  timelineZoomFactor = Math.max(0.6, Math.min(2.5, timelineZoomFactor + delta));
  renderNLETimeline();
}

// Transport Controls
function togglePlayPreview() {
  const btn = document.getElementById("playPauseBtn");
  if (isPlayingPreview) {
    isPlayingPreview = false;
    clearInterval(previewPlayTimer);
    btn.innerText = "▶️";
  } else {
    isPlayingPreview = true;
    btn.innerText = "⏸️";
    const total = currentProject ? currentProject.total_timeline_duration : 12;

    previewPlayTimer = setInterval(() => {
      currentPlayheadTime += 0.1;
      if (currentPlayheadTime >= total) currentPlayheadTime = 0.0;
      movePlayheadTo(currentPlayheadTime);

      // Find scene containing current time
      if (currentProject && currentProject.scenes) {
        const matching = currentProject.scenes.find(s => currentPlayheadTime >= s.timeline_start && currentPlayheadTime <= s.timeline_end);
        if (matching && matching.scene_id !== activeSceneId) {
          activeSceneId = matching.scene_id;
          updateLiveMonitorPreview();
          document.querySelectorAll(".nle-visual-clip").forEach(c => c.classList.remove("active"));
          const clipEl = document.getElementById(`nle-clip-${activeSceneId}`);
          if (clipEl) clipEl.classList.add("active");
        }
      }
    }, 100);
  }
}

function jumpStep(stepSeconds) {
  const total = currentProject ? currentProject.total_timeline_duration : 12;
  const newT = Math.max(0, Math.min(total, currentPlayheadTime + stepSeconds));
  movePlayheadTo(newT);
}

function jumpToFirstScene() {
  if (!currentProject || !currentProject.scenes) return;
  selectScene(currentProject.scenes[0].scene_id);
}

function jumpToLastScene() {
  if (!currentProject || !currentProject.scenes) return;
  selectScene(currentProject.scenes[currentProject.scenes.length - 1].scene_id);
}

// SERP API Modal
function openSerpModal(sceneId) {
  currentModalSceneId = sceneId;
  const scene = currentProject.scenes.find(s => s.scene_id === sceneId);
  if (!scene) return;

  document.getElementById("modalSearchInput").value = scene.search_query;
  document.getElementById("serpModal").classList.add("open");
  renderModalGrid(scene.visual_candidates || []);
}

function closeSerpModal() {
  document.getElementById("serpModal").classList.remove("open");
  currentModalSceneId = null;
}

async function executeModalSearch() {
  const query = document.getElementById("modalSearchInput").value.trim();
  const serpKey = document.getElementById("serpApiKey").value.trim();
  if (!query) return;

  SystemLogs.addLog("INFO", "SERP-API", `Executing visual search query: "${query}" (Scene: ${currentModalSceneId})`);

  try {
    const resp = await fetch("/api/search-media", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: query,
        category: currentProject.category,
        serp_api_key: serpKey
      })
    });
    const data = await resp.json();
    if (data.success) {
      SystemLogs.addLog("SUCCESS", "SERP-API", `Found ${data.candidates.length} visual candidates for "${query}"`);
      renderModalGrid(data.candidates);
    }
  } catch (err) {
    SystemLogs.addLog("ERROR", "SERP-API", `Visual search error: ${err.message}`);
    alert("Search error: " + err.message);
  }
}

function renderModalGrid(candidates) {
  const grid = document.getElementById("modalSearchResultsGrid");
  grid.innerHTML = "";

  candidates.forEach(cand => {
    const item = document.createElement("div");
    item.className = "media-bin-item";
    item.style.height = "120px";
    item.onclick = () => selectCandidate(cand);
    item.innerHTML = `
      <img src="${cand.thumbnail_url || cand.image_url}" alt="${cand.title}">
      <div style="position:absolute; bottom:4px; left:6px; right:6px; z-index:2;">
        <span style="font-size:9px; background:rgba(0,0,0,0.85); color:#FFF; padding:2px 4px; border-radius:3px;">Select Photo</span>
      </div>
    `;
    grid.appendChild(item);
  });
}

async function selectCandidate(candidate) {
  if (!currentProject || currentModalSceneId === null) return;

  SystemLogs.addLog("INFO", "MEDIA-BIN", `Swapping Scene ${currentModalSceneId} photo to: "${candidate.title || candidate.image_url.slice(0, 45)}"`);

  try {
    const resp = await fetch("/api/select-media", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_id: currentProject.project_id,
        scene_id: currentModalSceneId,
        image_url: candidate.image_url,
        thumbnail_url: candidate.thumbnail_url,
        title: candidate.title,
        source: candidate.source
      })
    });

    const data = await resp.json();
    if (data.success) {
      const idx = currentProject.scenes.findIndex(s => s.scene_id === currentModalSceneId);
      if (idx !== -1) {
        currentProject.scenes[idx] = data.scene;
      }
      SystemLogs.addLog("SUCCESS", "MEDIA-BIN", `Scene ${currentModalSceneId} media updated successfully.`);
      renderNLETimeline();
      renderMediaBin();
      updateLiveMonitorPreview();
      closeSerpModal();
    }
  } catch (err) {
    SystemLogs.addLog("ERROR", "MEDIA-BIN", `Failed to swap photo for scene ${currentModalSceneId}: ${err.message}`);
    alert("Failed to swap photo: " + err.message);
  }
}

// Step 4: Render Complete Single-Pass Video (FFmpeg)
async function handleRenderVideo() {
  if (!currentProject) {
    alert("Please generate storyboard and timeline first.");
    return;
  }

  const includeSubtitles = document.getElementById("chkSubtitles").checked;
  const includeTicker = document.getElementById("chkTicker").checked;
  const includeMusic = document.getElementById("chkMusic").checked;
  const defaultTransition = document.getElementById("globalTransitionSelect").value;
  const transitionDuration = parseFloat(document.getElementById("globalTransDurationSlider").value);
  const maxShotDurationSlider = document.getElementById("maxShotDurationSlider");
  const maxShotDuration = maxShotDurationSlider ? parseFloat(maxShotDurationSlider.value) : 3.0;

  SystemLogs.addLog(
    "INFO",
    "COMPOSER",
    `Queuing single-pass 1080p render for project "${currentProject.title}" (Subtitles: ${includeSubtitles}, Music: ${includeMusic}, Transition: ${defaultTransition})`
  );

  document.getElementById("renderModal").classList.add("open");
  document.getElementById("mainExportBtn").disabled = true;

  try {
    const resp = await fetch("/api/render-project", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project_id: currentProject.project_id,
        include_subtitles: includeSubtitles,
        include_ticker: includeTicker,
        include_music: includeMusic,
        default_transition: defaultTransition,
        transition_duration: transitionDuration,
        max_shot_duration: maxShotDuration
      })
    });

    const data = await resp.json();
    if (!data.success) {
      SystemLogs.addLog("ERROR", "COMPOSER", `Render start rejected: ${data.message}`);
      alert("Render failed: " + data.message);
      closeRenderModal();
      document.getElementById("mainExportBtn").disabled = false;
      return;
    }

    SystemLogs.addLog("INFO", "COMPOSER", `Render job accepted by background FFmpeg engine. Polling real-time progress...`);

    if (statusPollInterval) clearInterval(statusPollInterval);
    statusPollInterval = setInterval(pollRenderStatus, 1000);
  } catch (err) {
    SystemLogs.addLog("ERROR", "COMPOSER", `Render trigger exception: ${err.message}`);
    alert("Render trigger error: " + err.message);
    closeRenderModal();
    document.getElementById("mainExportBtn").disabled = false;
  }
}

async function pollRenderStatus() {
  if (!currentProject) return;

  try {
    const resp = await fetch(`/api/project-status/${currentProject.project_id}`);
    const data = await resp.json();

    const progressFill = document.getElementById("renderProgressBar");
    const progressLabel = document.getElementById("renderStageLabel");

    const percent = data.progress_percent || 0;
    progressFill.style.width = percent + "%";

    let stage = "Processing Continuous Audio & Timeline...";
    if (percent < 30) stage = "Analyzing Speech Pauses & Sizing Visual Clips...";
    else if (percent < 60) stage = "Synthesizing Continuous Voiceover & Subtitles...";
    else if (percent < 85) stage = "Single-Pass FFmpeg Compositing (Ken Burns + xfade Transitions)...";
    else if (percent < 100) stage = "Finalizing 1080p Broadcast Video Stream...";
    else stage = "Video Export Ready!";

    progressLabel.innerText = `${percent}% — ${stage}`;

    if (data.status === "completed" && data.output_video_path) {
      clearInterval(statusPollInterval);
      closeRenderModal();
      document.getElementById("mainExportBtn").disabled = false;
      SystemLogs.addLog("SUCCESS", "COMPOSER", `1080p Broadcast Video export complete! URL: ${data.output_video_path}`);

      // Switch Monitor Viewport to Rendered Video
      showRenderedVideo(data.output_video_path);
    } else if (data.status === "failed") {
      clearInterval(statusPollInterval);
      const errMsg = data.error_message || "FFmpeg single-pass export failed";
      SystemLogs.addLog("ERROR", "COMPOSER", `Rendering failed: ${errMsg}`);
      alert("Rendering error: " + errMsg);
      closeRenderModal();
      document.getElementById("mainExportBtn").disabled = false;
    }
  } catch (err) {
    console.error("Polling error:", err);
  }
}

function showRenderedVideo(videoUrl) {
  const canvasViewport = document.getElementById("canvasViewport");
  const videoPlayer = document.getElementById("finalRenderedVideo");
  const btnDownload = document.getElementById("btnDownloadRender");

  canvasViewport.style.display = "none";
  videoPlayer.style.display = "block";
  videoPlayer.src = videoUrl;
  videoPlayer.play().catch(() => {});

  btnDownload.style.display = "inline-block";
  btnDownload.onclick = () => {
    const a = document.createElement("a");
    a.href = videoUrl;
    a.download = `${currentProject.title || 'broadcast_video'}.mp4`;
    a.click();
    SystemLogs.addLog("INFO", "STUDIO-UI", `Downloaded rendered video: ${a.download}`);
  };
}

function closeRenderModal() {
  document.getElementById("renderModal").classList.remove("open");
}


// ==============================================================================
// SYSTEM LOGS CONTROLLER & REAL-TIME STREAMING MANAGER
// ==============================================================================
const SystemLogs = {
  logs: [],
  latestBackendId: 0,
  activeFilter: "all",
  searchQuery: "",
  isOpen: false,
  pollTimer: null,

  init() {
    this.addLog("INFO", "STUDIO", "AI Video Studio initialized. Activity monitor online.");
    this.fetchBackendLogs();
    
    // Background polling every 5 seconds when closed to keep badge count in sync
    setInterval(() => {
      if (!this.isOpen) {
        this.fetchBackendLogs(true);
      }
    }, 5000);
  },

  open() {
    this.isOpen = true;
    const sidebar = document.getElementById("systemLogsSidebar");
    const backdrop = document.getElementById("systemLogsBackdrop");
    const btn = document.getElementById("systemLogsBtn");
    if (sidebar) sidebar.classList.add("open");
    if (backdrop) backdrop.classList.add("open");
    if (btn) btn.classList.add("active");

    this.fetchBackendLogs();
    if (!this.pollTimer) {
      // Live streaming polling every 1200ms when drawer is actively open
      this.pollTimer = setInterval(() => this.fetchBackendLogs(), 1200);
    }
    this.render();
  },

  close() {
    this.isOpen = false;
    const sidebar = document.getElementById("systemLogsSidebar");
    const backdrop = document.getElementById("systemLogsBackdrop");
    const btn = document.getElementById("systemLogsBtn");
    if (sidebar) sidebar.classList.remove("open");
    if (backdrop) backdrop.classList.remove("open");
    if (btn) btn.classList.remove("active");

    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  },

  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  },

  addLog(level, source, message, details = null, pushToBackend = false) {
    const now = new Date();
    const timeStr = now.toTimeString().split(" ")[0] + "." + String(now.getMilliseconds()).padStart(3, "0");
    const entry = {
      id: "cli_" + Date.now() + "_" + Math.floor(Math.random() * 10000),
      timestamp: timeStr,
      level: (level || "INFO").toUpperCase(),
      source: (source || "UI").toUpperCase(),
      message: message,
      details: details,
      isClient: true
    };
    this.logs.push(entry);
    this.updateBadges();
    if (this.isOpen) {
      this.render();
    }

    if (pushToBackend) {
      fetch("/api/system-logs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          level: entry.level,
          source: entry.source,
          message: entry.message,
          details: entry.details
        })
      }).catch(() => {});
    }
  },

  async fetchBackendLogs(silent = false) {
    try {
      const resp = await fetch(`/api/system-logs?since_id=${this.latestBackendId}&limit=250`);
      if (!resp.ok) return;
      const data = await resp.json();
      if (data) {
        if (data.latest_id && data.latest_id > this.latestBackendId) {
          this.latestBackendId = data.latest_id;
        }
        if (data.logs && data.logs.length > 0) {
          const existingBackendIds = new Set(this.logs.filter(l => l.backendId).map(l => l.backendId));
          let addedCount = 0;

          data.logs.forEach(item => {
            if (!existingBackendIds.has(item.id)) {
              this.logs.push({
                id: "srv_" + item.id,
                backendId: item.id,
                timestamp: item.timestamp,
                level: item.level,
                source: item.source,
                message: item.message,
                details: item.details,
                isClient: false
              });
              existingBackendIds.add(item.id);
              addedCount++;
            }
          });

          if (addedCount > 0) {
            this.updateBadges();
            if (this.isOpen) {
              this.render();
            }
          }
        }
      }
    } catch (e) {
      // Backend temporarily offline or restarting
    }
  },

  updateBadges() {
    const total = this.logs.length;
    const errors = this.logs.filter(l => l.level === "ERROR").length;
    const warns = this.logs.filter(l => l.level === "WARNING" || l.level === "WARN").length;
    const infos = this.logs.filter(l => l.level === "INFO").length;
    const successes = this.logs.filter(l => l.level === "SUCCESS").length;

    const badge = document.getElementById("logsBadgeCount");
    if (badge) {
      badge.innerText = total;
      if (errors > 0) {
        badge.classList.add("has-error");
      } else {
        badge.classList.remove("has-error");
      }
    }

    const cAll = document.getElementById("chipCountAll");
    const cInfo = document.getElementById("chipCountInfo");
    const cSuccess = document.getElementById("chipCountSuccess");
    const cWarn = document.getElementById("chipCountWarn");
    const cError = document.getElementById("chipCountError");

    if (cAll) cAll.innerText = total;
    if (cInfo) cInfo.innerText = infos;
    if (cSuccess) cSuccess.innerText = successes;
    if (cWarn) cWarn.innerText = warns;
    if (cError) cError.innerText = errors;

    const stats = document.getElementById("logsFooterStats");
    if (stats) stats.innerText = `${total} events logged (${errors} errors, ${warns} warnings)`;
  },

  render() {
    const container = document.getElementById("logsContainer");
    if (!container) return;

    let filtered = this.logs;

    // Filter by Level
    if (this.activeFilter && this.activeFilter !== "all") {
      const fl = this.activeFilter.toUpperCase();
      if (fl === "WARNING") {
        filtered = filtered.filter(l => l.level === "WARNING" || l.level === "WARN");
      } else {
        filtered = filtered.filter(l => l.level === fl);
      }
    }

    // Filter by Search Query
    if (this.searchQuery && this.searchQuery.trim()) {
      const q = this.searchQuery.trim().toLowerCase();
      filtered = filtered.filter(l =>
        l.message.toLowerCase().includes(q) ||
        l.source.toLowerCase().includes(q) ||
        (l.details && JSON.stringify(l.details).toLowerCase().includes(q))
      );
    }

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="logs-empty-state">
          <div class="logs-empty-icon">📂</div>
          <div>No log entries matching filter.</div>
        </div>
      `;
      return;
    }

    const html = filtered.map(log => {
      const lvl = log.level.toLowerCase();
      const safeMsg = escapeHtml(log.message);
      let detailsHtml = "";
      if (log.details) {
        const detailsStr = typeof log.details === "object" ? JSON.stringify(log.details, null, 2) : String(log.details);
        detailsHtml = `<div class="log-details-block">${escapeHtml(detailsStr)}</div>`;
      }

      return `
        <div class="log-entry level-${lvl}" id="${log.id}">
          <div class="log-meta-row">
            <span class="log-time">${log.timestamp}</span>
            <span class="log-badge-level">${log.level}</span>
            <span class="log-tag-source">[${log.source}]</span>
            <button class="log-copy-inline" onclick="copySingleLog('${log.id}', event)" title="Copy log">📋</button>
          </div>
          <div class="log-text">${safeMsg}</div>
          ${detailsHtml}
        </div>
      `;
    }).join("");

    container.innerHTML = html;

    const autoScroll = document.getElementById("chkAutoScroll");
    if (autoScroll && autoScroll.checked) {
      this.scrollToBottom();
    }
  },

  scrollToBottom() {
    const vp = document.getElementById("logsViewport");
    if (vp) {
      vp.scrollTop = vp.scrollHeight;
    }
  },

  async clear() {
    this.logs = [];
    this.latestBackendId = 0;
    this.updateBadges();
    this.render();
    try {
      await fetch("/api/system-logs/clear", { method: "POST" });
    } catch (e) {}
    this.addLog("INFO", "SYSTEM", "Log stream reset by user");
  },

  copyAll() {
    if (this.logs.length === 0) {
      alert("No logs to copy");
      return;
    }
    const lines = this.logs.map(l => {
      const det = l.details ? ` | ${typeof l.details === "object" ? JSON.stringify(l.details) : l.details}` : "";
      return `[${l.timestamp}] [${l.level.padEnd(7)}] [${l.source.padEnd(10)}] ${l.message}${det}`;
    });
    navigator.clipboard.writeText(lines.join("\n")).then(() => {
      const btns = document.querySelectorAll(".logs-header-actions button");
      btns.forEach(b => {
        if (b.innerText.includes("Copy")) {
          const orig = b.innerHTML;
          b.innerHTML = `<span>✅</span> Copied!`;
          setTimeout(() => b.innerHTML = orig, 1500);
        }
      });
    });
  },

  download() {
    const lines = this.logs.map(l => {
      const det = l.details ? ` | ${typeof l.details === "object" ? JSON.stringify(l.details) : l.details}` : "";
      return `[${l.timestamp}] [${l.level.padEnd(7)}] [${l.source.padEnd(10)}] ${l.message}${det}`;
    });
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `system_engine_logs_${Date.now()}.log`;
    a.click();
    URL.revokeObjectURL(url);
  }
};

// Global Exposure for HTML onclick handlers
function toggleSystemLogs() {
  SystemLogs.toggle();
}

function openSystemLogs() {
  SystemLogs.open();
}

function closeSystemLogs() {
  SystemLogs.close();
}

function clearSystemLogs() {
  SystemLogs.clear();
}

function copySystemLogs() {
  SystemLogs.copyAll();
}

function downloadSystemLogs() {
  SystemLogs.download();
}

function setLogFilter(filter) {
  SystemLogs.activeFilter = filter;
  document.querySelectorAll(".log-chip").forEach(c => {
    if (c.getAttribute("data-filter") === filter) {
      c.classList.add("active");
    } else {
      c.classList.remove("active");
    }
  });
  SystemLogs.render();
}

function handleLogSearch(query) {
  SystemLogs.searchQuery = query;
  const btnClear = document.getElementById("btnClearSearch");
  if (btnClear) {
    btnClear.style.display = query ? "block" : "none";
  }
  SystemLogs.render();
}

function clearLogSearch() {
  const input = document.getElementById("logsSearchQuery");
  if (input) input.value = "";
  handleLogSearch("");
}

function scrollLogsToBottom() {
  SystemLogs.scrollToBottom();
}

function copySingleLog(logId, event) {
  if (event) event.stopPropagation();
  const log = SystemLogs.logs.find(l => l.id === logId);
  if (!log) return;
  const str = `[${log.timestamp}] [${log.level}] [${log.source}] ${log.message}`;
  navigator.clipboard.writeText(str).then(() => {
    const el = document.getElementById(logId);
    if (el) {
      const btn = el.querySelector(".log-copy-inline");
      if (btn) {
        btn.innerText = "✓";
        setTimeout(() => btn.innerText = "📋", 1200);
      }
    }
  });
}

function escapeHtml(text) {
  if (!text) return "";
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return String(text).replace(/[&<>"']/g, m => map[m]);
}

