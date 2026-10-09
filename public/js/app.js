/**
 * app.js — BJ Suno Songs Player
 * Full audio engine, search & filter, queue management, lyrics modal, and media session API.
 */

(function () {
  'use strict';

  // State
  let songs = [];
  let filteredSongs = [];
  let currentTrackIndex = -1;
  let isPlaying = false;
  let isShuffle = false;
  let repeatMode = 'all'; // 'off' | 'all' | 'one'
  let currentView = localStorage.getItem('suno_view_mode') || 'grid';
  let activeTag = 'all';
  let searchQuery = '';

  // DOM Elements
  const audio = new Audio();
  const songsContainer = document.getElementById('songsContainer');
  const searchInput = document.getElementById('searchInput');
  const filterPills = document.getElementById('filterPills');
  const viewGridBtn = document.getElementById('viewGridBtn');
  const viewListBtn = document.getElementById('viewListBtn');
  const playAllBtn = document.getElementById('playAllBtn');
  const shuffleAllBtn = document.getElementById('shuffleAllBtn');
  const shareBtn = document.getElementById('shareBtn');

  // Stats Elements
  const statTracks = document.getElementById('statTracks');
  const statRuntime = document.getElementById('statRuntime');

  // Player Elements
  const playerBar = document.getElementById('playerBar');
  const playerThumb = document.getElementById('playerThumb');
  const playerTitle = document.getElementById('playerTitle');
  const playerArtist = document.getElementById('playerArtist');
  const ctrlPlayBtn = document.getElementById('ctrlPlayBtn');
  const ctrlPrevBtn = document.getElementById('ctrlPrevBtn');
  const ctrlNextBtn = document.getElementById('ctrlNextBtn');
  const ctrlShuffleBtn = document.getElementById('ctrlShuffleBtn');
  const ctrlRepeatBtn = document.getElementById('ctrlRepeatBtn');
  const progressBarWrap = document.getElementById('progressBarWrap');
  const progressBarFill = document.getElementById('progressBarFill');
  const timeCurrent = document.getElementById('timeCurrent');
  const timeTotal = document.getElementById('timeTotal');
  const volumeSlider = document.getElementById('volumeSlider');
  const volumeBtn = document.getElementById('volumeBtn');
  const lyricsToggleBtn = document.getElementById('lyricsToggleBtn');
  const playerSunoLink = document.getElementById('playerSunoLink');

  // Modal Elements
  const lyricsModalOverlay = document.getElementById('lyricsModalOverlay');
  const modalCloseBtn = document.getElementById('modalCloseBtn');
  const modalSongTitle = document.getElementById('modalSongTitle');
  const modalSongTags = document.getElementById('modalSongTags');
  const modalLyricsBody = document.getElementById('modalLyricsBody');
  const copyLyricsBtn = document.getElementById('copyLyricsBtn');
  const modalSunoBtn = document.getElementById('modalSunoBtn');

  // Format seconds to mm:ss
  function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }

  // Load Catalog
  async function initCatalog() {
    if (window.SUNO_CATALOG && Array.isArray(window.SUNO_CATALOG)) {
      songs = window.SUNO_CATALOG;
    } else {
      try {
        const resp = await fetch('data/songs.json');
        songs = await resp.json();
      } catch (e) {
        console.error('Failed to load songs.json:', e);
        songsContainer.innerHTML = `<div style="text-align:center; padding: 40px; color: #ef4444;">Failed to load catalog.</div>`;
        return;
      }
    }

    filteredSongs = [...songs];
    updateStats();
    buildTagPills();
    renderSongs();

    // Restore view mode
    setViewMode(currentView);

    // Initial audio setup
    audio.volume = parseFloat(volumeSlider.value) || 0.8;
  }

  function updateStats() {
    if (statTracks) statTracks.textContent = songs.length;
    if (statRuntime) {
      const totalSec = songs.reduce((acc, s) => acc + (s.duration || 0), 0);
      const mins = Math.round(totalSec / 60);
      statRuntime.textContent = `${mins}m`;
    }
  }

  // Generate category tag filter pills
  function buildTagPills() {
    if (!filterPills) return;

    const tagsSet = new Set();
    songs.forEach((s) => {
      if (s.tags) {
        s.tags.split(',').forEach((t) => {
          const clean = t.trim();
          if (clean.length > 3 && clean.length < 24) {
            tagsSet.add(clean);
          }
        });
      }
    });

    const popularTags = Array.from(tagsSet).slice(0, 8);
    let html = `<button class="pill active" data-tag="all">All Songs (${songs.length})</button>`;
    popularTags.forEach((t) => {
      html += `<button class="pill" data-tag="${t.toLowerCase()}">${t}</button>`;
    });
    filterPills.innerHTML = html;

    filterPills.querySelectorAll('.pill').forEach((btn) => {
      btn.addEventListener('click', () => {
        filterPills.querySelectorAll('.pill').forEach((p) => p.classList.remove('active'));
        btn.classList.add('active');
        activeTag = btn.getAttribute('data-tag');
        applyFilters();
      });
    });
  }

  // Filter & Search
  function applyFilters() {
    const q = searchQuery.toLowerCase().trim();
    filteredSongs = songs.filter((s) => {
      const matchQuery =
        !q ||
        (s.title && s.title.toLowerCase().includes(q)) ||
        (s.tags && s.tags.toLowerCase().includes(q)) ||
        (s.prompt && s.prompt.toLowerCase().includes(q)) ||
        (s.hook && s.hook.toLowerCase().includes(q));

      const matchTag =
        activeTag === 'all' ||
        (s.tags && s.tags.toLowerCase().includes(activeTag));

      return matchQuery && matchTag;
    });

    renderSongs();
  }

  // Render View
  function renderSongs() {
    if (!songsContainer) return;

    if (filteredSongs.length === 0) {
      songsContainer.innerHTML = `
        <div style="text-align: center; padding: 60px 20px; color: var(--text-muted); grid-column: 1 / -1;">
          <p style="font-size: 1.1rem; font-weight: 600; color: #fff; margin-bottom: 6px;">No tracks found</p>
          <p>Try searching for a different keyword or resetting filters.</p>
        </div>
      `;
      return;
    }

    if (currentView === 'grid') {
      songsContainer.className = 'songs-grid';
      songsContainer.innerHTML = filteredSongs.map((s, idx) => {
        const isCurrent = currentTrackIndex >= 0 && songs[currentTrackIndex]?.id === s.id;
        const playingClass = isCurrent && isPlaying ? 'is-active is-playing' : isCurrent ? 'is-active' : '';

        return `
          <div class="song-card ${playingClass}" data-id="${s.id}">
            <div class="card-media" onclick="window.playerApp.playById('${s.id}')">
              <img class="card-img" src="${s.image_url || 'favicon.svg'}" alt="${s.title}" loading="lazy" />
              <span class="duration-badge">${s.duration_formatted || formatTime(s.duration)}</span>
              <div class="play-overlay">
                <div class="play-circle">
                  ${isCurrent && isPlaying ? pauseIconSvg() : playIconSvg()}
                </div>
              </div>
            </div>
            <div class="card-body">
              <h3 class="card-title" title="${s.title}" onclick="window.playerApp.playById('${s.id}')" style="cursor: pointer;">${s.title}</h3>
              <div class="card-tags" title="${s.tags}">${s.tags || 'Suno AI Original'}</div>
              <p class="card-hook" title="${s.hook}">“${s.hook || 'Original lyrics and prompt'}”</p>
              <div class="card-footer">
                <button class="card-action-btn" onclick="window.playerApp.openLyrics('${s.id}')">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
                  Lyrics
                </button>
                <a class="card-action-btn" href="${s.suno_url || s.share_url}" target="_blank" rel="noopener">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                  Suno
                </a>
              </div>
            </div>
          </div>
        `;
      }).join('');
    } else {
      songsContainer.className = 'tracklist-view';
      songsContainer.innerHTML = filteredSongs.map((s, idx) => {
        const isCurrent = currentTrackIndex >= 0 && songs[currentTrackIndex]?.id === s.id;
        const playingClass = isCurrent && isPlaying ? 'is-active is-playing' : isCurrent ? 'is-active' : '';

        return `
          <div class="track-row ${playingClass}" data-id="${s.id}">
            <div class="track-idx" onclick="window.playerApp.playById('${s.id}')" style="cursor: pointer;">
              ${isCurrent && isPlaying ? '▶' : (idx + 1)}
            </div>
            <img class="track-thumb" src="${s.image_url || 'favicon.svg'}" alt="${s.title}" onclick="window.playerApp.playById('${s.id}')" style="cursor: pointer;" />
            <div class="track-info" onclick="window.playerApp.playById('${s.id}')" style="cursor: pointer;">
              <h3>${s.title}</h3>
              <p>“${s.hook || s.tags || ''}”</p>
            </div>
            <div class="track-tags">${s.tags ? s.tags.split(',')[0] : ''}</div>
            <div class="track-duration">${s.duration_formatted || formatTime(s.duration)}</div>
            <div class="track-actions">
              <button class="card-action-btn" onclick="window.playerApp.openLyrics('${s.id}')" title="View Lyrics">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
              </button>
              <a class="card-action-btn" href="${s.suno_url || s.share_url}" target="_blank" rel="noopener" title="Open on Suno">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
              </a>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  // Playback Control
  function playTrack(index) {
    if (index < 0 || index >= songs.length) return;

    currentTrackIndex = index;
    const track = songs[currentTrackIndex];

    let streamUrl = track.audio_url || track.video_url;
    // Automatic fallback if streamUrl is an incompatible CloudFront m4a-opus link
    if (streamUrl && streamUrl.includes('cloudfront.net') && streamUrl.endsWith('.m4a')) {
      streamUrl = track.video_url || `https://cdn1.suno.ai/${track.id}.mp4`;
    }

    if (!streamUrl) {
      alert('Audio stream not available for this track.');
      return;
    }

    // Immediately update player metadata and track styling
    updatePlayerUI();
    renderSongs();

    if (audio.src !== streamUrl) {
      audio.src = streamUrl;
    }

    audio.play().catch((err) => {
      if (err.name === 'AbortError') return;
      console.warn('Playback error:', err);
      isPlaying = false;
      updatePlayerUI();
      renderSongs();
    });
  }

  function togglePlay() {
    if (currentTrackIndex === -1) {
      if (songs.length > 0) playTrack(0);
      return;
    }

    if (audio.paused) {
      audio.play().catch((err) => {
        if (err.name === 'AbortError') return;
        console.warn('Playback error:', err);
      });
    } else {
      audio.pause();
    }
  }

  function nextTrack() {
    if (songs.length === 0) return;
    if (isShuffle) {
      let nextIdx = Math.floor(Math.random() * songs.length);
      if (nextIdx === currentTrackIndex && songs.length > 1) {
        nextIdx = (nextIdx + 1) % songs.length;
      }
      playTrack(nextIdx);
    } else {
      const nextIdx = (currentTrackIndex + 1) % songs.length;
      playTrack(nextIdx);
    }
  }

  function prevTrack() {
    if (audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }
    if (songs.length === 0) return;
    const prevIdx = (currentTrackIndex - 1 + songs.length) % songs.length;
    playTrack(prevIdx);
  }

  function updatePlayerUI() {
    const track = songs[currentTrackIndex];
    if (!track) return;

    playerTitle.textContent = track.title;
    playerArtist.textContent = `${track.artist || 'BJ Akui'} • ${track.tags ? track.tags.split(',')[0] : 'Suno'}`;
    playerThumb.src = track.image_url || 'favicon.svg';

    if (playerSunoLink) {
      playerSunoLink.href = track.suno_url || track.share_url;
    }

    ctrlPlayBtn.innerHTML = isPlaying ? pauseIconSvg() : playIconSvg();
    timeTotal.textContent = track.duration_formatted || formatTime(track.duration);
  }

  // Audio Event Listeners
  audio.addEventListener('play', () => {
    isPlaying = true;
    updatePlayerUI();
    renderSongs();
    updateMediaSession();
  });

  audio.addEventListener('pause', () => {
    isPlaying = false;
    updatePlayerUI();
    renderSongs();
  });

  audio.addEventListener('timeupdate', () => {
    if (!audio.duration) return;
    const pct = (audio.currentTime / audio.duration) * 100;
    progressBarFill.style.width = `${pct}%`;
    timeCurrent.textContent = formatTime(audio.currentTime);
  });

  audio.addEventListener('loadedmetadata', () => {
    timeTotal.textContent = formatTime(audio.duration);
  });

  audio.addEventListener('ended', () => {
    if (repeatMode === 'one') {
      audio.currentTime = 0;
      audio.play();
    } else if (repeatMode === 'all' || isShuffle) {
      nextTrack();
    } else {
      isPlaying = false;
      updatePlayerUI();
      renderSongs();
    }
  });

  // Scrubber Seeking
  progressBarWrap.addEventListener('click', (e) => {
    const rect = progressBarWrap.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    if (audio.duration) {
      audio.currentTime = pos * audio.duration;
    }
  });

  // Volume
  volumeSlider.addEventListener('input', (e) => {
    audio.volume = parseFloat(e.target.value);
    audio.muted = false;
  });

  volumeBtn.addEventListener('click', () => {
    audio.muted = !audio.muted;
    if (audio.muted) {
      volumeSlider.value = 0;
    } else {
      volumeSlider.value = audio.volume || 0.8;
    }
  });

  // Shuffle & Repeat
  ctrlShuffleBtn.addEventListener('click', () => {
    isShuffle = !isShuffle;
    ctrlShuffleBtn.classList.toggle('active', isShuffle);
  });

  ctrlRepeatBtn.addEventListener('click', () => {
    if (repeatMode === 'all') {
      repeatMode = 'one';
      ctrlRepeatBtn.classList.add('active');
      ctrlRepeatBtn.setAttribute('title', 'Repeat: Current Track');
    } else if (repeatMode === 'one') {
      repeatMode = 'off';
      ctrlRepeatBtn.classList.remove('active');
      ctrlRepeatBtn.setAttribute('title', 'Repeat: Off');
    } else {
      repeatMode = 'all';
      ctrlRepeatBtn.classList.add('active');
      ctrlRepeatBtn.setAttribute('title', 'Repeat: All Tracks');
    }
  });

  // View Mode
  function setViewMode(mode) {
    currentView = mode;
    localStorage.setItem('suno_view_mode', mode);
    if (viewGridBtn && viewListBtn) {
      viewGridBtn.classList.toggle('active', mode === 'grid');
      viewListBtn.classList.toggle('active', mode === 'list');
    }
    renderSongs();
  }

  if (viewGridBtn) viewGridBtn.addEventListener('click', () => setViewMode('grid'));
  if (viewListBtn) viewListBtn.addEventListener('click', () => setViewMode('list'));

  // Search input
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      applyFilters();
    });
  }

  // Quick Action Buttons
  if (playAllBtn) {
    playAllBtn.addEventListener('click', () => {
      if (filteredSongs.length > 0) {
        const firstId = filteredSongs[0].id;
        window.playerApp.playById(firstId);
      }
    });
  }

  if (shuffleAllBtn) {
    shuffleAllBtn.addEventListener('click', () => {
      isShuffle = true;
      ctrlShuffleBtn.classList.add('active');
      if (filteredSongs.length > 0) {
        const randIdx = Math.floor(Math.random() * filteredSongs.length);
        window.playerApp.playById(filteredSongs[randIdx].id);
      }
    });
  }

  if (shareBtn) {
    shareBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(window.location.href);
      const originalText = shareBtn.innerHTML;
      shareBtn.innerHTML = `✓ Copied Link!`;
      setTimeout(() => {
        shareBtn.innerHTML = originalText;
      }, 2000);
    });
  }

  // Lyrics Modal
  function openLyrics(id) {
    const track = songs.find((s) => s.id === id);
    if (!track) return;

    modalSongTitle.textContent = track.title;
    modalSongTags.textContent = track.tags || 'Suno AI v6';

    // Format lyrics with verse markers highlighted
    let formattedPrompt = (track.prompt || 'No lyrics available.').replace(
      /(\[[^\]]+\])/g,
      '<span class="lyrics-verse-tag">$1</span>'
    );
    modalLyricsBody.innerHTML = formattedPrompt;

    modalSunoBtn.href = track.suno_url || track.share_url;
    lyricsModalOverlay.classList.add('open');
  }

  function closeLyrics() {
    lyricsModalOverlay.classList.remove('open');
  }

  modalCloseBtn.addEventListener('click', closeLyrics);
  lyricsModalOverlay.addEventListener('click', (e) => {
    if (e.target === lyricsModalOverlay) closeLyrics();
  });

  if (copyLyricsBtn) {
    copyLyricsBtn.addEventListener('click', () => {
      const activeLyrics = modalLyricsBody.innerText;
      navigator.clipboard.writeText(activeLyrics);
      copyLyricsBtn.textContent = '✓ Copied Lyrics!';
      setTimeout(() => {
        copyLyricsBtn.textContent = 'Copy Lyrics';
      }, 2000);
    });
  }

  if (lyricsToggleBtn) {
    lyricsToggleBtn.addEventListener('click', () => {
      if (currentTrackIndex >= 0) {
        openLyrics(songs[currentTrackIndex].id);
      }
    });
  }

  // Media Session API for Lock Screen & Bluetooth Controls
  function updateMediaSession() {
    if (!('mediaSession' in navigator)) return;
    const track = songs[currentTrackIndex];
    if (!track) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title,
      artist: track.artist || 'BJ Akui',
      album: 'BJ Suno Songs Collection',
      artwork: [
        { src: track.image_url || 'favicon.svg', sizes: '512x512', type: 'image/jpeg' },
      ],
    });

    navigator.mediaSession.setActionHandler('play', () => togglePlay());
    navigator.mediaSession.setActionHandler('pause', () => togglePlay());
    navigator.mediaSession.setActionHandler('previoustrack', () => prevTrack());
    navigator.mediaSession.setActionHandler('nexttrack', () => nextTrack());
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (details.seekTime && audio.duration) {
        audio.currentTime = details.seekTime;
      }
    });
  }

  // Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    if (e.code === 'Space') {
      e.preventDefault();
      togglePlay();
    } else if (e.code === 'ArrowRight') {
      e.preventDefault();
      if (audio.duration) audio.currentTime = Math.min(audio.duration, audio.currentTime + 5);
    } else if (e.code === 'ArrowLeft') {
      e.preventDefault();
      if (audio.duration) audio.currentTime = Math.max(0, audio.currentTime - 5);
    } else if (e.key === 'm' || e.key === 'M') {
      audio.muted = !audio.muted;
    } else if (e.key === 'l' || e.key === 'L') {
      if (lyricsModalOverlay.classList.contains('open')) {
        closeLyrics();
      } else if (currentTrackIndex >= 0) {
        openLyrics(songs[currentTrackIndex].id);
      }
    } else if (e.key === 'Escape') {
      closeLyrics();
    }
  });

  // Hook Up Player Button Events
  ctrlPlayBtn.addEventListener('click', togglePlay);
  ctrlNextBtn.addEventListener('click', nextTrack);
  ctrlPrevBtn.addEventListener('click', prevTrack);

  // SVG Helpers
  function playIconSvg() {
    return `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`;
  }

  function pauseIconSvg() {
    return `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`;
  }

  // Expose global app for inline HTML clicks
  window.playerApp = {
    playById: function (id) {
      const idx = songs.findIndex((s) => s.id === id);
      if (idx !== -1) {
        if (idx === currentTrackIndex) {
          togglePlay();
        } else {
          playTrack(idx);
        }
      }
    },
    openLyrics: openLyrics,
  };

  // Run
  document.addEventListener('DOMContentLoaded', initCatalog);
})();
