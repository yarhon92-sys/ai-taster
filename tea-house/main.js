const DESIGN_WIDTH = 1920;
const DESIGN_HEIGHT = 1080;
const TIMELINE_SECTOR_COUNT = 8;
const TIMELINE_OUTER_ROTATION_MS = 40000;
const TIMELINE_SECTOR_ADVANCE_MS = TIMELINE_OUTER_ROTATION_MS * 3;
const TIMELINE_SECTOR_DEGREES = 45;
const TIMELINE_VIDEO_NAMES = ["破晓", "晨息", "朝明", "昼盛", "午荫", "暮染", "夜临", "星眠"];
const SCENE_AUDIO_VOLUME = 0.55;

const panelAssets = {
  timeline: {
    src: "素材/时序详情面板.png",
    alt: "时序详情面板",
  },
  notice: {
    src: "素材/公告详情面板.png",
    alt: "公告详情面板",
  },
};

const stage = document.querySelector("#stage");
const modal = document.querySelector("#detailModal");
const modalImage = document.querySelector("#modalImage");
const closeButton = document.querySelector(".modal-close");
const backdrop = document.querySelector(".modal-backdrop");
const triggers = Array.from(document.querySelectorAll("[data-panel]"));
const timelineTrigger = document.querySelector(".timeline-trigger");
const timelineParticles = document.querySelector(".timeline-particles");
const sceneVideos = Array.from(document.querySelectorAll(".scene-video"));

let activeTrigger = null;
let currentTimelineSector = 0;
let timelineSparkTimer = null;
let activeSceneVideoIndex = 0;
let pendingSceneVideoSrc = "";
let sceneAudioEnabled = false;

function resizeStage() {
  const scale = Math.min(window.innerWidth / DESIGN_WIDTH, window.innerHeight / DESIGN_HEIGHT);
  document.documentElement.style.setProperty("--stage-scale", scale.toFixed(4));
}

function openPanel(panelName, trigger) {
  const panel = panelAssets[panelName];

  if (!panel) {
    return;
  }

  activeTrigger = trigger;
  modalImage.src = panel.src;
  modalImage.alt = panel.alt;
  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  closeButton.focus({ preventScroll: true });
}

function closePanel() {
  if (!modal.classList.contains("is-open")) {
    return;
  }

  modal.classList.remove("is-open");
  modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
  modalImage.alt = "";

  if (activeTrigger) {
    activeTrigger.focus({ preventScroll: true });
    activeTrigger = null;
  }
}

function getTimelineVideoSrc(sector) {
  const videoName = TIMELINE_VIDEO_NAMES[sector % TIMELINE_VIDEO_NAMES.length];
  return `时序背景视频/${videoName}.mp4`;
}

function setSceneVideoAudio(video, isAudible) {
  video.muted = !isAudible;
  video.volume = isAudible ? SCENE_AUDIO_VOLUME : 0;
}

function playSceneVideo(video) {
  const playPromise = video.play();

  if (playPromise) {
    playPromise.catch(() => {
      video.classList.remove("is-active");
    });
  }
}

function enableSceneAudio() {
  if (sceneAudioEnabled || sceneVideos.length < 1) {
    return;
  }

  sceneAudioEnabled = true;
  const activeVideo = sceneVideos[activeSceneVideoIndex];
  setSceneVideoAudio(activeVideo, true);
  playSceneVideo(activeVideo);
}

function updateSceneMediaForSector(sector) {
  if (sceneVideos.length < 2) {
    return;
  }

  const nextSrc = getTimelineVideoSrc(sector);
  const activeVideo = sceneVideos[activeSceneVideoIndex];
  const standbyVideo = sceneVideos[1 - activeSceneVideoIndex];

  if (activeVideo.getAttribute("src") === nextSrc) {
    setSceneVideoAudio(activeVideo, sceneAudioEnabled);
    playSceneVideo(activeVideo);
    return;
  }

  pendingSceneVideoSrc = nextSrc;
  standbyVideo.classList.remove("is-active");
  setSceneVideoAudio(standbyVideo, false);
  standbyVideo.pause();
  standbyVideo.currentTime = 0;
  standbyVideo.src = nextSrc;
  standbyVideo.load();

  const activateStandbyVideo = () => {
    if (pendingSceneVideoSrc !== nextSrc) {
      return;
    }

    standbyVideo.classList.add("is-active");
    setSceneVideoAudio(standbyVideo, sceneAudioEnabled);
    setSceneVideoAudio(activeVideo, false);
    activeVideo.classList.remove("is-active");
    playSceneVideo(standbyVideo);
    activeVideo.pause();
    activeSceneVideoIndex = 1 - activeSceneVideoIndex;
  };

  if (standbyVideo.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
    activateStandbyVideo();
    return;
  }

  standbyVideo.addEventListener("canplay", activateStandbyVideo, { once: true });
  standbyVideo.addEventListener("error", () => {
    if (pendingSceneVideoSrc === nextSrc) {
      pendingSceneVideoSrc = "";
    }
  }, { once: true });
}

function triggerTimelineSpark() {
  if (!timelineParticles) {
    return;
  }

  window.clearTimeout(timelineSparkTimer);
  timelineParticles.classList.remove("is-sparkling");
  void timelineParticles.offsetWidth;
  timelineParticles.classList.add("is-sparkling");

  timelineSparkTimer = window.setTimeout(() => {
    timelineParticles.classList.remove("is-sparkling");
  }, 1200);
}

function setTimelineSector(sector, options = {}) {
  if (!timelineTrigger) {
    return;
  }

  const nextSector = ((sector % TIMELINE_SECTOR_COUNT) + TIMELINE_SECTOR_COUNT) % TIMELINE_SECTOR_COUNT;
  currentTimelineSector = nextSector;
  timelineTrigger.style.setProperty(
    "--timeline-sector-angle",
    `-${currentTimelineSector * TIMELINE_SECTOR_DEGREES}deg`,
  );
  updateSceneMediaForSector(currentTimelineSector);

  if (options.spark) {
    triggerTimelineSpark();
  }
}

function advanceTimelineSector() {
  setTimelineSector(currentTimelineSector + 1, { spark: true });
}

resizeStage();
setTimelineSector(currentTimelineSector);
window.addEventListener("resize", resizeStage);
window.addEventListener("pointerdown", enableSceneAudio, { once: true });
window.addEventListener("keydown", enableSceneAudio, { once: true });
window.setInterval(advanceTimelineSector, TIMELINE_SECTOR_ADVANCE_MS);

triggers.forEach((trigger) => {
  trigger.addEventListener("click", () => {
    openPanel(trigger.dataset.panel, trigger);
  });
});

closeButton.addEventListener("click", closePanel);
backdrop.addEventListener("click", closePanel);

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closePanel();
  }
});

stage.addEventListener("transitionend", () => {
  if (!modal.classList.contains("is-open")) {
    modalImage.removeAttribute("src");
  }
});
