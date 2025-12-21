import './styles.css';
import { Chart } from 'chart.js/auto';
import { jsPDF } from 'jspdf';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { AudioAnalyzer } from './audioAnalyzer.js';
import { getAllCultures, getCultureById, matchCulture } from './culturesData.js';
import { getAllExpandedCultures } from './expandedCultures.js';
import { RealTimePitchDetector, Visualizer3D, ProgressTracker, musicalGlossary } from './advancedFeatures.js';
import { MusicComposer, Looper, PitchMatchingGame, RhythmDictation, InstrumentIdentifier, downloadJSON, generatePDF } from './games.js';
import { culturalQuizQuestions, getRandomQuestions, lessonPlans, practiceExercises, accessibilityHelpers, mobileOptimizations } from './extendedFeatures.js';

// Global state
let audioAnalyzer;
let currentAudio = null;
let audioContext = null;
let mediaRecorder = null;
let audioChunks = [];
let currentCulture = null;
let pitchDetector = null;
let visualizer = null;
let progressTracker = null;
let composer = null;
let looper = null;
let pitchGame = null;
let isDarkMode = false;
let analysisCancelled = false;

// Initialize the app
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Global error handlers to surface issues in UI
        window.addEventListener('error', (event) => {
            console.error('Uncaught error:', event.error || event.message);
            const analysisResults = document.getElementById('analysis-results');
            if (analysisResults) {
                analysisResults.innerHTML = `
                    <div style="padding: 20px; background: #ffebee; border-radius: 8px; border-left: 4px solid #f44336;">
                        <h4 style="color: #c62828; margin-top: 0;">❌ App Error</h4>
                        <p style="color: #d32f2f; margin: 10px 0;">${(event.error && event.error.message) || event.message || 'Unknown error'}</p>
                        <p style="margin: 0; font-size: 0.9em;">Open the browser console for details.</p>
                    </div>
                `;
                analysisResults.style.display = 'block';
            }
        });
        window.addEventListener('unhandledrejection', (event) => {
            console.error('Unhandled rejection:', event.reason);
            const analysisResults = document.getElementById('analysis-results');
            if (analysisResults) {
                analysisResults.innerHTML = `
                    <div style="padding: 20px; background: #ffebee; border-radius: 8px; border-left: 4px solid #f44336;">
                        <h4 style="color: #c62828; margin-top: 0;">❌ App Error</h4>
                        <p style="color: #d32f2f; margin: 10px 0;">${(event.reason && event.reason.message) || 'Unhandled promise rejection'}</p>
                        <p style="margin: 0; font-size: 0.9em;">Open the browser console for details.</p>
                    </div>
                `;
                analysisResults.style.display = 'block';
            }
        });
        audioAnalyzer = new AudioAnalyzer();
        await audioAnalyzer.initialize();
        audioContext = audioAnalyzer.audioContext;
        // Create master gain for global volume control (Classroom Mode)
        try {
            const masterGain = audioContext.createGain();
            // Increased from 0.35 to 1.0 for maximum audio output
            masterGain.gain.value = 1.0;
            masterGain.connect(audioContext.destination);
            window.__MASTER_GAIN = masterGain;
        } catch (e) {
            console.warn('Master gain init failed:', e);
        }
        
        progressTracker = new ProgressTracker();
        progressTracker.loadProgress();
        
        // Initialize accessibility features
        if (mobileOptimizations.isMobile()) {
            mobileOptimizations.optimizeForMobile();
            mobileOptimizations.enableTouchGestures();
        }
        
        // Initialize accessibility controls
        initializeAccessibility();
        
        composer = new MusicComposer(audioContext);
        pitchGame = new PitchMatchingGame(audioContext);
        
        initializeTabs();
        initializeCultureExplorer();
        initializeAnalyzer();
        initializeGames();
        initializeRecorder();
        initializeLivePitch();
        initializeComposer();
        initializeProgress();
        initializeDarkMode();
        initializeClassroomMode();
        displayExpandedCultures();
        initializeExtendedQuiz();
        initializeLessonPlans();
        initializeAudioUnlockOverlay();
        initializeTeacherDashboard();
        if (process.env.NODE_ENV === 'production') {
            registerServiceWorker();
        }
        
        // console.log('✅ App initialized successfully!');
    } catch (error) {
        console.error('❌ Error initializing app:', error);
    }
});

// Tab Navigation - Event delegation to avoid duplicate listeners
let tabListenersInitialized = false;

function initializeTabs() {
    if (tabListenersInitialized) return; // Only setup once
    
    document.addEventListener('click', (e) => {
        if (!e.target?.classList.contains('tab-btn')) return;
        
        const tabName = e.target.dataset.tab;
        const tabButtons = document.querySelectorAll('.tab-btn');
        const tabContents = document.querySelectorAll('.tab-content');
        
        // Update active states
        tabButtons.forEach(btn => btn.classList.remove('active'));
        tabContents.forEach(content => content.classList.remove('active'));
        
        e.target.classList.add('active');
        document.getElementById(`${tabName}-tab`)?.classList.add('active');
    });
    
    tabListenersInitialized = true;
}

// PWA: Register Service Worker
function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker
                .register('sw.js')
                .then(reg => console.log('Service worker registered', reg.scope))
                .catch(err => console.warn('Service worker registration failed', err));
        });
    }
}

// Teacher Dashboard (local only)
let dashboardSession = null;
let dashboardTimer = null;

function initializeTeacherDashboard() {
    const startBtn = document.getElementById('start-session-btn');
    const endBtn = document.getElementById('end-session-btn');
    const exportBtn = document.getElementById('export-csv-btn');
    const clearBtn = document.getElementById('clear-session-btn');
    
    // Load saved session if exists
    loadDashboardSession();
    
    startBtn?.addEventListener('click', () => {
        const className = document.getElementById('class-name-input')?.value || 'Untitled Class';
        const studentCount = parseInt(document.getElementById('student-count-input')?.value) || 25;
        
        dashboardSession = {
            className,
            studentCount,
            startTime: new Date().toISOString(),
            activities: {
                tracksAnalyzed: 0,
                gamesPlayed: 0,
                quizzesTaken: 0,
                totalTimeSeconds: 0
            },
            events: []
        };
        
        saveDashboardSession();
        showActiveSession();
        startBtn.style.display = 'none';
        endBtn.style.display = 'inline-block';
        
        // Start session timer: increment seconds every 1s, update UI every 3s when Dashboard tab is visible
        let secondsCounter = 0;
        if (dashboardTimer) clearInterval(dashboardTimer);
        dashboardTimer = setInterval(() => {
            if (!dashboardSession) {
                clearInterval(dashboardTimer);
                dashboardTimer = null;
                return;
            }
            dashboardSession.activities.totalTimeSeconds++;
            secondsCounter++;
            if (secondsCounter % 3 === 0) {
                const dashboardTab = document.getElementById('dashboard-tab');
                if (dashboardTab?.classList.contains('active')) {
                    updateDashboardDisplay();
                }
            }
        }, 1000);
    });
    
    endBtn?.addEventListener('click', () => {
        if (confirm('End this session? Data will be saved locally.')) {
            if (dashboardTimer) clearInterval(dashboardTimer);
            dashboardTimer = null;
            saveDashboardSession();
            alert('Session ended. Data saved locally.');
        }
    });
    
    exportBtn?.addEventListener('click', () => {
        exportSessionToCSV();
    });
    
    clearBtn?.addEventListener('click', () => {
        if (confirm('Clear all session data? This cannot be undone.')) {
            dashboardSession = null;
            localStorage.removeItem('teacherDashboard');
            if (dashboardTimer) clearInterval(dashboardTimer);
            dashboardTimer = null;
            document.getElementById('active-session-panel').style.display = 'none';
            document.getElementById('start-session-btn').style.display = 'inline-block';
            document.getElementById('end-session-btn').style.display = 'none';
            alert('Session data cleared.');
        }
    });
}

function loadDashboardSession() {
    const saved = localStorage.getItem('teacherDashboard');
    if (saved) {
        try {
            dashboardSession = JSON.parse(saved);
            showActiveSession();
            updateDashboardDisplay();
            document.getElementById('start-session-btn').style.display = 'none';
            document.getElementById('end-session-btn').style.display = 'inline-block';
        } catch (e) {
            console.warn('Failed to load dashboard session', e);
        }
    }
}

function saveDashboardSession() {
    if (dashboardSession) {
        localStorage.setItem('teacherDashboard', JSON.stringify(dashboardSession));
    }
}

function showActiveSession() {
    const panel = document.getElementById('active-session-panel');
    if (panel) panel.style.display = 'block';
}

function updateDashboardDisplay() {
    if (!dashboardSession) return;
    
    const classNameEl = document.getElementById('current-class-name');
    const studentCountEl = document.getElementById('current-student-count');
    const startTimeEl = document.getElementById('session-start-time');
    const durationEl = document.getElementById('session-duration');
    
    if (classNameEl) classNameEl.textContent = dashboardSession.className;
    if (studentCountEl) studentCountEl.textContent = dashboardSession.studentCount;
    if (startTimeEl) startTimeEl.textContent = new Date(dashboardSession.startTime).toLocaleString();
    
    const totalSec = dashboardSession.activities.totalTimeSeconds;
    const hours = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    if (durationEl) durationEl.textContent = `${hours}h ${mins}m ${secs}s`;
    
    // Update activity counts
    const tracksEl = document.getElementById('tracks-analyzed-count');
    const gamesEl = document.getElementById('games-played-count');
    const quizzesEl = document.getElementById('quizzes-taken-count');
    const avgTimeEl = document.getElementById('avg-time-on-task');
    
    if (tracksEl) tracksEl.textContent = dashboardSession.activities.tracksAnalyzed;
    if (gamesEl) gamesEl.textContent = dashboardSession.activities.gamesPlayed;
    if (quizzesEl) quizzesEl.textContent = dashboardSession.activities.quizzesTaken;
    
    const totalActivities = dashboardSession.activities.tracksAnalyzed + 
                           dashboardSession.activities.gamesPlayed + 
                           dashboardSession.activities.quizzesTaken;
    
    if (avgTimeEl) {
        if (totalActivities > 0) {
            const avgSec = Math.floor(totalSec / totalActivities);
            const avgMin = Math.floor(avgSec / 60);
            const avgSecRem = avgSec % 60;
            avgTimeEl.textContent = `${avgMin}m ${avgSecRem}s`;
        } else {
            avgTimeEl.textContent = '—';
        }
    }
}

function exportSessionToCSV() {
    if (!dashboardSession) {
        alert('No session data to export');
        return;
    }
    
    let csv = 'Class Name,Student Count,Start Time,Duration (seconds),Tracks Analyzed,Games Played,Quizzes Taken\n';
    csv += `"${dashboardSession.className}",${dashboardSession.studentCount},"${dashboardSession.startTime}",${dashboardSession.activities.totalTimeSeconds},${dashboardSession.activities.tracksAnalyzed},${dashboardSession.activities.gamesPlayed},${dashboardSession.activities.quizzesTaken}\n`;
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `session-${dashboardSession.className.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

// Track dashboard activities when they occur
function trackDashboardActivity(type) {
    if (!dashboardSession) return;
    
    if (type === 'analyze') {
        dashboardSession.activities.tracksAnalyzed++;
    } else if (type === 'game') {
        dashboardSession.activities.gamesPlayed++;
    } else if (type === 'quiz') {
        dashboardSession.activities.quizzesTaken++;
    }
    
    dashboardSession.events.push({
        type,
        timestamp: new Date().toISOString()
    });
    
    saveDashboardSession();
    updateDashboardDisplay();
}


// Audio unlock overlay for iPad/Safari autoplay policies
function initializeAudioUnlockOverlay() {
    const overlay = document.getElementById('audio-unlock-overlay');
    const btn = document.getElementById('audio-unlock-button');
    if (!overlay || !btn) return;
    const shouldShow = () => {
        const isMobile = /iPad|iPhone|iPod|Android/i.test(navigator.userAgent);
        return isMobile || (audioContext && audioContext.state === 'suspended');
    };
    const hide = () => overlay.style.display = 'none';
    const show = () => overlay.style.display = 'flex';

    if (shouldShow()) show();
    btn.addEventListener('click', async () => {
        try {
            if (audioContext && audioContext.state === 'suspended') {
                await audioContext.resume();
            }
            hide();
        } catch (e) {
            console.warn('Audio resume failed:', e);
        }
    });
    // Any user gesture can unlock
    ['touchstart','mousedown','keydown'].forEach(ev => {
        window.addEventListener(ev, async () => {
            try {
                if (audioContext && audioContext.state === 'suspended') {
                    await audioContext.resume();
                }
                hide();
            } catch {}
        }, { once: true, passive: true });
    });
}

// Culture Explorer
function initializeCultureExplorer() {
    const basicCultures = getAllCultures();
    const expandedCultures = getAllExpandedCultures();
    const cultures = [...basicCultures, ...expandedCultures];
    const cultureGrid = document.getElementById('culture-grid');
    
    // Initialize world map
    initializeWorldMap(cultures);
    
    cultures.forEach(culture => {
        const card = document.createElement('div');
        card.className = 'culture-card';
        card.innerHTML = `
            <div style="font-size: 3em; margin-bottom: 10px;">${culture.emoji}</div>
            <h3>${culture.name}</h3>
            <p>${culture.region}</p>
        `;
        
        card.addEventListener('click', () => showCultureDetails(culture));
        cultureGrid.appendChild(card);
    });
}

function initializeWorldMap(cultures) {
    const mapElement = document.getElementById('world-map');
    if (!mapElement) return;
    
    // Create Leaflet map centered on world
    const map = L.map(mapElement).setView([20, 0], 2);
    
    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
        minZoom: 2
    }).addTo(map);
    
    // Define region coordinates (approx centers) and colors
    const regionCoordinates = {
        'East Asia': { lat: 35, lng: 105, color: '#FF6B6B' },
        'South Asia': { lat: 20, lng: 78, color: '#4ECDC4' },
        'West Africa': { lat: 5, lng: -5, color: '#FFE66D' },
        'Middle East': { lat: 25, lng: 50, color: '#95E1D3' },
        'Southeast Asia': { lat: 5, lng: 115, color: '#F38181' },
        'Europe': { lat: 50, lng: 10, color: '#AA96DA' },
        'Latin America': { lat: -10, lng: -60, color: '#FCBAD3' },
        'Aboriginal Australian': { lat: -25, lng: 133, color: '#A8D8EA' },
        'Sub-Saharan Africa': { lat: -5, lng: 20, color: '#F7DC6F' },
        'Mediterranean': { lat: 40, lng: 15, color: '#BB8FCE' }
    };
    
    // Group cultures by region and add markers
    const regionMarkers = {};
    const regionLegend = document.getElementById('map-legend');
    let legendHTML = '';
    
    cultures.forEach(culture => {
        const region = culture.region;
        if (regionCoordinates[region]) {
            const coords = regionCoordinates[region];
            
            if (!regionMarkers[region]) {
                regionMarkers[region] = [];
                // Add legend entry
                legendHTML += `
                    <div style="padding: 10px; background: white; border-radius: 6px; border-left: 4px solid ${coords.color}; cursor: pointer;" data-region="${region}">
                        <strong style="color: ${coords.color};">●</strong> ${region}
                    </div>
                `;
            }
            
            regionMarkers[region].push({
                coords: coords,
                culture: culture,
                offset: regionMarkers[region].length * 0.5 // Offset for clusters
            });
        }
    });
    
    // Add markers to map
    Object.entries(regionMarkers).forEach(([region, markers]) => {
        const color = regionCoordinates[region].color;
        
        markers.forEach(({ coords, culture, offset }) => {
            const marker = L.circleMarker(
                [coords.lat + offset, coords.lng + offset],
                {
                    radius: 8,
                    fillColor: color,
                    color: '#333',
                    weight: 2,
                    opacity: 0.8,
                    fillOpacity: 0.7
                }
            ).addTo(map);
            
            // Popup with culture info
            marker.bindPopup(`
                <div style="font-weight: bold; margin-bottom: 5px;">
                    ${culture.emoji} ${culture.name}
                </div>
                <div style="font-size: 0.85em;">
                    <strong>Region:</strong> ${culture.region}<br>
                    <strong>Description:</strong> ${culture.description.substring(0, 60)}...
                </div>
            `);
            
            // Click to filter cultures
            marker.on('click', () => {
                filterCulturesByRegion(region);
            });
        });
    });
    
    // Add legend event listeners
    regionLegend.innerHTML = legendHTML;
    regionLegend.querySelectorAll('[data-region]').forEach(item => {
        item.addEventListener('click', () => {
            const region = item.dataset.region;
            filterCulturesByRegion(region);
            item.style.backgroundColor = '#f0f0f0';
            item.style.transform = 'scale(1.05)';
        });
    });
    
    // Fit map to bounds of all markers
    const group = new L.featureGroup(Object.values(regionMarkers).flat().map(m => 
        L.circleMarker([m.coords.lat, m.coords.lng])
    ));
    if (group.getLayers().length > 0) {
        map.fitBounds(group.getBounds().pad(0.1));
    }
}

function filterCulturesByRegion(region) {
    const cultureCards = document.querySelectorAll('.culture-card');
    let visibleCount = 0;
    
    cultureCards.forEach(card => {
        const cardRegion = card.querySelector('p').textContent;
        if (cardRegion === region) {
            card.style.display = 'block';
            card.style.opacity = '1';
            visibleCount++;
        } else {
            card.style.display = 'none';
            card.style.opacity = '0.3';
        }
    });
    
    // Scroll to culture grid
    const grid = document.getElementById('culture-grid');
    if (grid) {
        grid.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

function showCultureDetails(culture) {
    currentCulture = culture;
    const playerSection = document.getElementById('player-section');
    const titleElement = document.getElementById('current-culture-title');
    const infoElement = document.getElementById('culture-info');
    
    titleElement.textContent = `${culture.emoji} ${culture.name} Music`;
    
    infoElement.innerHTML = `
        <p><strong>Region:</strong> ${culture.region}</p>
        <p><strong>Description:</strong> ${culture.description}</p>
        <h4>Musical Characteristics:</h4>
        <ul>
            <li><strong>Rhythm:</strong> ${culture.characteristics.rhythm}</li>
            <li><strong>Scales:</strong> ${culture.characteristics.scales}</li>
            <li><strong>Instruments:</strong> ${culture.characteristics.instruments}</li>
            <li><strong>Tempo:</strong> ${culture.characteristics.tempo}</li>
        </ul>
        <h4>Interesting Facts:</h4>
        <ul>
            ${culture.facts.map(fact => `<li>${fact}</li>`).join('')}
        </ul>
    `;
    
    playerSection.style.display = 'block';
    playerSection.scrollIntoView({ behavior: 'smooth' });
    
    // Set up play button
    const playBtn = document.getElementById('play-btn');
    const stopBtn = document.getElementById('stop-btn');
    
    playBtn.onclick = () => playCultureDemo(culture);
    stopBtn.onclick = () => stopCultureDemo();
}

async function playCultureDemo(culture) {
    // Create a musical demonstration based on culture characteristics
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    // Resume audio context if suspended
    if (audioContext.state === 'suspended') {
        await audioContext.resume();
    }
    
    // Different scales for different cultures
    const scales = {
        'chinese-traditional': ['C4', 'D4', 'E4', 'G4', 'A4', 'C5'], // Pentatonic
        'indian-classical': ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'], // Raga-inspired
        'west-african': ['C4', 'D4', 'E4', 'G4', 'A4'], // Pentatonic
        'middle-eastern': ['C4', 'Db4', 'E4', 'F4', 'G4', 'Ab4', 'B4', 'C5'], // Maqam-inspired
        'latin-american': ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'], // Major scale
        'japanese-traditional': ['D4', 'F4', 'G4', 'A4', 'C5'], // Japanese pentatonic
        'european-folk': ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'], // Major
        'aboriginal-australian': ['C3', 'E3', 'G3', 'C4'] // Drone-based
    };
    
    const scale = scales[culture.id] || scales['chinese-traditional'];
    
    // Play a simple melody using Web Audio API
    const currentTime = audioContext.currentTime;
    scale.forEach((note, i) => {
        playNote(noteToFrequency(note), currentTime + i * 0.5, 0.4);
    });
    
    visualizeWaveform();
}

function noteToFrequency(note) {
    const noteMap = {
        'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
        'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8,
        'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11
    };
    
    const match = note.match(/([A-G][b#]?)(\d)/);
    if (!match) return 440;
    
    const noteName = match[1];
    const octave = parseInt(match[2]);
    const noteNumber = noteMap[noteName];
    const a4 = 440;
    const semitones = (octave - 4) * 12 + noteNumber - 9;
    
    return a4 * Math.pow(2, semitones / 12);
}

function playNote(frequency, time, duration) {
    // Ensure audioContext exists and is running
    if (!audioContext) {
        console.warn('playNote: audioContext not initialized');
        return;
    }
    
    // Resume if suspended (Safari)
    if (audioContext.state === 'suspended') {
        audioContext.resume().catch(e => console.warn('Resume failed:', e));
    }
    
    try {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        // Use master gain if available, otherwise connect directly
        const masterGain = (typeof window !== 'undefined' && window.__MASTER_GAIN) ? window.__MASTER_GAIN : null;
        if (masterGain) {
            gainNode.connect(masterGain);
        } else {
            gainNode.connect(audioContext.destination);
        }
        
        oscillator.frequency.value = frequency;
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0, time);
        gainNode.gain.linearRampToValueAtTime(0.85, time + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.01, time + duration);
        
        oscillator.start(time);
        oscillator.stop(time + duration);
    } catch (e) {
        console.error('playNote error:', e);
    }
}

function stopCultureDemo() {
    if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
    }
}

let animationId = null;

function visualizeWaveform() {
    const canvas = document.getElementById('waveform');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    // Simple waveform visualization
    ctx.fillStyle = '#2c3e50';
    ctx.fillRect(0, 0, width, height);
    
    ctx.strokeStyle = '#3498db';
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    for (let x = 0; x < width; x++) {
        const y = height / 2 + Math.sin(x * 0.05) * 50 * Math.sin(Date.now() * 0.001);
        if (x === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    }
    
    ctx.stroke();
    // Only continue animation if we're on the explore tab AND waveform canvas exists
    const exploreTab = document.getElementById('explore-tab');
    const waveformCanvas = document.getElementById('waveform');
    if (exploreTab && exploreTab.classList.contains('active') && waveformCanvas && waveformCanvas.offsetParent !== null) {
        animationId = requestAnimationFrame(visualizeWaveform);
    } else if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }
}

// Audio Analyzer
function initializeAnalyzer() {
    const fileInput = document.getElementById('file-input');
    const uploadLabel = document.querySelector('label[for="file-input"]');
    
    // console.log('initializeAnalyzer called');
    // console.log('fileInput:', fileInput);
    // console.log('uploadLabel:', uploadLabel);
    
    if (uploadLabel) {
        uploadLabel.addEventListener('click', (e) => {
            // console.log('Upload button clicked!');
            e.preventDefault();
            fileInput.click();
        });
    }
    
    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        // console.log('File input changed. File:', file);
        if (!file) {
            // console.log('No file selected');
            return;
        }
        
        // console.log('=== FILE UPLOAD STARTED ===');
        // console.log('File:', file.name, 'Type:', file.type, 'Size:', file.size);
        
        try {
            // Show loading state IMMEDIATELY
            const analysisResults = document.getElementById('analysis-results');
            // console.log('analysis-results element:', analysisResults);
            
            if (!analysisResults) {
                console.error('analysis-results element not found!');
                alert('Error: Results container not found');
                return;
            }
            
            analysisResults.innerHTML = '<p style="padding: 40px; text-align: center; font-size: 2em; background: #ffeb3b; color: #000; border-radius: 8px; font-weight: bold;">🔄 LOADING FILE...</p>';
            analysisResults.style.display = 'block';
            // console.log('Loading message displayed');
            
            // console.log('File selected:', file.name, file.type, 'Size:', file.size, 'bytes');
            
            // Validate file size (max 100MB)
            const maxSize = 100 * 1024 * 1024;
            if (file.size > maxSize) {
                throw new Error(`File is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum size is 100MB.`);
            }
            
            // console.log('Reading file as ArrayBuffer...');
            const arrayBuffer = await file.arrayBuffer();
            // console.log('ArrayBuffer created, size:', arrayBuffer.byteLength);
            
            // Update UI - starting decode
            analysisResults.innerHTML = '<p style="padding: 40px; text-align: center; font-size: 2em; background: #e1bee7; color: #4a148c; border-radius: 8px; font-weight: bold;">🎵 DECODING AUDIO...</p>';
            await new Promise(resolve => setTimeout(resolve, 100)); // Allow UI to update
            
            // Resume AudioContext if suspended (with timeout)
            if (audioAnalyzer.audioContext.state === 'suspended') {
                // console.log('AudioContext suspended, resuming...');
                try {
                    // Race resume() against a 2-second timeout
                    await Promise.race([
                        audioAnalyzer.audioContext.resume(),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('AudioContext resume timeout')), 2000))
                    ]);
                    // console.log('AudioContext resumed successfully');
                } catch (resumeErr) {
                    console.error('AudioContext resume failed or timed out:', resumeErr);
                    // Continue anyway - try to decode even if resume failed
                }
            }
            // console.log('AudioContext state:', audioAnalyzer.audioContext.state);
            
            // Attempt to decode the audio with promise + callback fallback (better cross-browser support)
            let audioBuffer;
            try {
                // console.log('=== STARTING AUDIO DECODE ===');
                // console.log('File type:', file.type);
                // console.log('File name:', file.name);
                // console.log('ArrayBuffer size:', arrayBuffer.byteLength);
                // console.log('About to call decodeAudioBuffer...');
                
                // Update UI before decode
                analysisResults.innerHTML = '<p style="padding: 40px; text-align: center; font-size: 1.5em; background: #ffccbc; color: #bf360c; border-radius: 8px; font-weight: bold;">⏳ Calling decode function...</p>';
                await new Promise(resolve => setTimeout(resolve, 200));
                
                // console.log('Calling decodeAudioBuffer NOW');
                audioBuffer = await decodeAudioBuffer(arrayBuffer, file);
                // console.log('decodeAudioBuffer returned!');
                // console.log('=== DECODE SUCCESSFUL ===');
                // console.log('Audio decoded successfully. Duration:', audioBuffer.duration, 'seconds');
                // console.log('Sample rate:', audioBuffer.sampleRate);
                // console.log('Channels:', audioBuffer.numberOfChannels);
            } catch (decodeError) {
                console.error('Decode error:', decodeError);
                console.error('Error name:', decodeError.name);
                console.error('Error message:', decodeError.message);
                
                // Provide specific error messages for different formats
                if (file.type === 'audio/mpeg' || file.name.toLowerCase().endsWith('.mp3')) {
                    throw new Error('MP3 format detected. MP3 has limited browser support. Please convert to WAV, OGG, or FLAC format.');
                } else if (file.type === 'audio/x-m4a' || file.type === 'audio/mp4' || file.name.toLowerCase().endsWith('.m4a')) {
                    throw new Error('M4A format detected. Try converting to WAV or OGG format for better compatibility.');
                } else if (file.name.toLowerCase().endsWith('.wav')) {
                    throw new Error(`WAV file decode failed: ${decodeError.message}. The file may be corrupted or use an unsupported WAV encoding (e.g., ADPCM). Try exporting as PCM 16-bit WAV.`);
                } else {
                    throw new Error(`Unable to decode audio (${file.type || 'unknown type'}): ${decodeError.message}`);
                }
            }
            
            // console.log('=== DECODE COMPLETE - STARTING ANALYSIS ===');
            analysisResults.innerHTML = '<p style="padding: 40px; text-align: center; font-size: 2em; background: #c8e6c9; color: #1b5e20; border-radius: 8px; font-weight: bold;">✅ STARTING ANALYSIS...</p>';
            await new Promise(resolve => setTimeout(resolve, 100));
        
        // Create audio player for the uploaded file
        const audioUrl = URL.createObjectURL(file);
        const audioPlayer = document.createElement('audio');
        audioPlayer.controls = true;
        audioPlayer.src = audioUrl;
        audioPlayer.style.width = '100%';
        audioPlayer.style.marginBottom = '20px';
        
        // console.log('Calling analyzeAudioFile...');
        await analyzeAudioFile(audioBuffer, file.name, audioPlayer);
        } catch (error) {
            console.error('Analysis error:', error);
            const analysisResults = document.getElementById('analysis-results');
            analysisResults.innerHTML = `
                <div style="padding: 20px; background: #ffebee; border-radius: 8px; border-left: 4px solid #f44336;">
                    <h4 style="color: #c62828; margin-top: 0;">❌ Analysis Failed</h4>
                    <p style="color: #d32f2f; margin: 10px 0;"><strong>Error:</strong> ${error.message}</p>
                    <div style="background: white; padding: 15px; border-radius: 4px; margin-top: 15px; font-size: 0.9em;">
                        <p style="margin-top: 0;"><strong>💡 Supported Formats & Solutions:</strong></p>
                        <ul style="margin: 10px 0; padding-left: 20px; line-height: 1.6;">
                            <li><strong>✅ Best formats:</strong> WAV, OGG, FLAC</li>
                            <li><strong>⚠️ Limited support:</strong> MP3, M4A (depends on browser)</li>
                            <li><strong>Converting MP3 to WAV:</strong>
                                <div style="background: #f5f5f5; padding: 8px 12px; border-radius: 4px; margin-top: 5px; font-family: monospace; font-size: 0.85em; overflow-x: auto;">
                                    ffmpeg -i file.mp3 file.wav
                                </div>
                            </li>
                            <li>Ensure the file is a valid audio file</li>
                            <li>Try a shorter audio clip (under 5 minutes)</li>
                            <li>Check that the file is not corrupted</li>
                        </ul>
                    </div>
                </div>
            `;
            analysisResults.style.display = 'block';
        }
    });
}

// Store chart instances globally for download
let pitchChart = null;
let rhythmChart = null;
let spectralChart = null;
let currentAnalysisData = null;

// Robust decode helper (supports promise and callback forms)
async function decodeAudioBuffer(arrayBuffer, file) {
    // console.log('decodeAudioBuffer called');
    // console.log('ArrayBuffer size:', arrayBuffer.byteLength);
    // console.log('File type:', file.type);
    // console.log('File name:', file.name);
    
    // Check if file is actually an audio file by looking at the header
    const view = new Uint8Array(arrayBuffer, 0, 12);
    // console.log('File header (first 12 bytes):', Array.from(view).map(b => b.toString(16).padStart(2, '0')).join(' '));
    
    // Create a COPY of the ArrayBuffer because decodeAudioData consumes it
    const bufferCopy = arrayBuffer.slice(0);
    // console.log('Created buffer copy, size:', bufferCopy.byteLength);
    
    // Create a timeout promise
    const timeout = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Audio decode timeout after 5 seconds')), 5000)
    );
    
    // Try promise-based decode first
    const decodePromise = new Promise(async (resolve, reject) => {
        try {
            // console.log('Trying promise-based decodeAudioData...');
            const decoded = await audioAnalyzer.audioContext.decodeAudioData(bufferCopy);
            // console.log('Promise-based decode succeeded');
            resolve(decoded);
        } catch (promiseErr) {
            // console.log('Promise-based decode failed:', promiseErr.message);
            reject(promiseErr);
        }
    });
    
    // Race between decode and timeout
    return Promise.race([decodePromise, timeout]);
}

async function analyzeAudioFile(audioBuffer, filename = 'audio-file', audioPlayer = null) {
    const analysisResults = document.getElementById('analysis-results');
    const cancelBtn = document.getElementById('cancel-analysis');
    try {
        // console.log('analyzeAudioFile called');
        // Prepare cancel handling
        analysisCancelled = false;
        let onCancel;
        if (cancelBtn) {
            cancelBtn.style.display = 'inline-block';
            onCancel = () => { analysisCancelled = true; };
            cancelBtn.addEventListener('click', onCancel, { once: true });
        }
        analysisResults.innerHTML = '<p style="padding: 20px; text-align: center; font-size: 1.1em;"><strong>📊 Processing audio...</strong></p>';
        analysisResults.style.display = 'block';
        
        // Get audio data (limit to first 15 seconds to keep UI responsive)
        // console.log('Getting channel data...');
        const channelData = audioBuffer.getChannelData(0);
        const sampleRate = audioBuffer.sampleRate;
        const maxDurationSec = 15;
        const trimmedSamples = Math.min(channelData.length, Math.floor(sampleRate * maxDurationSec));
        const trimmedChannel = channelData.slice(0, trimmedSamples);
        // console.log('Channel data ready: length', trimmedChannel.length, 'at', sampleRate, 'Hz');
        
        // Update UI with progress
        analysisResults.innerHTML = '<p style="padding: 40px; text-align: center; font-size: 1.8em; background: #fff3e0; color: #e65100; border-radius: 8px;"><strong>🎵 Analyzing rhythm...</strong></p>';
        await new Promise(resolve => setTimeout(resolve, 500)); // Allow UI to update
        
        // Analyze rhythm
        if (analysisCancelled) throw new Error('Analysis cancelled');
        // console.log('Analyzing rhythm...');
        const rhythmAnalysis = audioAnalyzer.analyzeRhythm(trimmedChannel);
        
        // Enhanced rhythm analysis with temporal features
        const temporalFeatures = audioAnalyzer.calculateTemporalFeatures(rhythmAnalysis.intervals || []);
        const polyrhythm = audioAnalyzer.detectPolyrhythm(rhythmAnalysis.intervals || []);
        const zcr = audioAnalyzer.calculateZCR(trimmedChannel);
        
        rhythmAnalysis.temporalComplexity = temporalFeatures.complexity;
        rhythmAnalysis.entropy = temporalFeatures.entropy;
        rhythmAnalysis.polyrhythmic = polyrhythm.isPolyrhythmic;
        rhythmAnalysis.polyrhythmRatio = polyrhythm.ratio;
        rhythmAnalysis.percussiveness = zcr; // Higher ZCR indicates more percussive content
        
        // console.log('✓ Rhythm analysis complete:', rhythmAnalysis.tempo, 'BPM');
        // console.log('Rhythm regularity:', rhythmAnalysis.regularity);
        // console.log('Temporal complexity:', temporalFeatures.complexity.toFixed(3));
        // console.log('Polyrhythmic:', polyrhythm.isPolyrhythmic);
        await new Promise(resolve => setTimeout(resolve, 500)); // Allow UI to update
        
        // Analyze pitch (more samples for better accuracy)
        if (analysisCancelled) throw new Error('Analysis cancelled');
        analysisResults.innerHTML = '<p style="padding: 40px; text-align: center; font-size: 1.8em; background: #f3e5f5; color: #6a1b9a; border-radius: 8px;"><strong>🎸 Analyzing pitch...</strong></p>';
        await new Promise(resolve => setTimeout(resolve, 500)); // Allow UI to update
        // console.log('Analyzing pitch...');
        const pitches = [];
        const timestamps = [];
        const sampleSize = 4096;
        let frames = 0;
        const maxFrames = 20; // Drastically reduced to prevent freeze
        // console.log('Starting pitch detection, max frames:', maxFrames);
        for (let i = 0; i < trimmedChannel.length - sampleSize; i += sampleSize * 64) {
            if (analysisCancelled) throw new Error('Analysis cancelled');
            const sample = trimmedChannel.slice(i, i + sampleSize);
            const pitch = audioAnalyzer.detectPitch(sample);
            if (pitch > 0 && pitch < 2000) { // Filter out noise
                pitches.push(pitch);
                timestamps.push(i / sampleRate);
            }
            frames++;
            
            // Yield to browser every 5 frames
            if (frames % 5 === 0) {
                await new Promise(resolve => setTimeout(resolve, 0));
            }
            
            if (frames >= maxFrames) break;
        }
        // console.log('✓ Pitch analysis complete. Found', pitches.length, 'pitches');
        await new Promise(resolve => setTimeout(resolve, 500)); // Allow UI to update
        
        // Spectral analysis
        if (analysisCancelled) throw new Error('Analysis cancelled');
        analysisResults.innerHTML = '<p style="padding: 40px; text-align: center; font-size: 1.8em; background: #e8f5e9; color: #2e7d32; border-radius: 8px;"><strong>📈 Analyzing spectrum...</strong></p>';
        await new Promise(resolve => setTimeout(resolve, 500)); // Allow UI to update
        // console.log('Analyzing spectrum...');
        // console.log('Calling analyzeSpectrum with', trimmedChannel.length, 'samples at', sampleRate, 'Hz');
        const spectralAnalysis = analyzeSpectrum(trimmedChannel, sampleRate);
        // console.log('✓ Spectral analysis complete');
        // console.log('Centroid:', spectralAnalysis.centroid, 'Brightness:', spectralAnalysis.brightness);

        // Restore proper HTML structure for charts
        analysisResults.innerHTML = `
            ${audioPlayer ? '<div style="margin: 0 0 20px; padding: 15px; background: #e3f2fd; border-radius: 8px; border-left: 4px solid #2196f3;"><h4 style="margin: 0 0 10px; color: #1565c0;">🔊 Audio Playback</h4>' + audioPlayer.outerHTML + '</div>' : ''}
            <div class="analysis-grid">
                <div class="analysis-card">
                    <h3>Pitch Analysis</h3>
                    <canvas id="pitch-chart" width="400" height="300"></canvas>
                    <div id="pitch-info"></div>
                </div>
                
                <div class="analysis-card">
                    <h3>Rhythm Analysis</h3>
                    <canvas id="rhythm-chart" width="400" height="300"></canvas>
                    <div id="rhythm-info"></div>
                </div>
                
                <div class="analysis-card">
                    <h3>Spectral Features</h3>
                    <canvas id="spectral-chart" width="400" height="300"></canvas>
                    <div id="spectral-info"></div>
                </div>
                
                <div class="analysis-card">
                    <h3>Cultural Insights</h3>
                    <div id="cultural-insights"></div>
                </div>
            </div>
        `;
        
        // Store full analysis data
        currentAnalysisData = {
            filename: filename,
            duration: audioBuffer.duration,
            sampleRate: sampleRate,
            rhythm: rhythmAnalysis,
            pitches: pitches,
            timestamps: timestamps,
            spectral: spectralAnalysis,
            analyzedAt: new Date().toISOString()
        };
        
        displayPitchAnalysis(pitches, timestamps);
        displayRhythmAnalysis(rhythmAnalysis);
        displaySpectralAnalysis(spectralAnalysis);
        
        // Identify scale
        const scaleAnalysis = audioAnalyzer.identifyScale(pitches);
        
        // Display musical characteristics (not cultural matching)
        displayMusicalInsights(rhythmAnalysis, scaleAnalysis, spectralAnalysis);
        
        // Add download functionality
        setupDownloadButtons();
        // console.log('Analysis completed successfully');
        if (cancelBtn) cancelBtn.style.display = 'none';
    } catch (error) {
        console.error('Analysis error:', error);
        if (cancelBtn) cancelBtn.style.display = 'none';
        analysisResults.innerHTML = `
            <div style="padding: 20px; background: #ffebee; border-radius: 8px; border-left: 4px solid #f44336;">
                <h4 style="color: #c62828; margin-top: 0;">❌ Analysis Failed</h4>
                <p style="color: #d32f2f; margin: 10px 0;"><strong>Error:</strong> ${error.message}</p>
                <p style="margin: 0; font-size: 0.9em;">Check the console for details and try another WAV/OGG/FLAC file.</p>
            </div>
        `;
        analysisResults.style.display = 'block';
    }
}

function displayPitchAnalysis(pitches, timestamps) {
    const chartElement = document.getElementById('pitch-chart');
    const pitchInfo = document.getElementById('pitch-info');
    
    if (!chartElement) {
        console.error('pitch-chart element not found');
        return;
    }
    
    const ctx = chartElement.getContext('2d');
    
    // Destroy existing chart
    if (pitchChart) pitchChart.destroy();
    
    // Convert to MIDI notes and count occurrences
    const midiNotes = pitches.map(p => audioAnalyzer.frequencyToMidiNote(p));
    const histogram = {};
    midiNotes.forEach(note => {
        histogram[note] = (histogram[note] || 0) + 1;
    });
    
    const sortedNotes = Object.entries(histogram)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 12);
    
    pitchChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sortedNotes.map(([note]) => audioAnalyzer.midiToNoteName(parseInt(note))),
            datasets: [{
                label: 'Note Frequency Distribution',
                data: sortedNotes.map(([, count]) => count),
                backgroundColor: 'rgba(102, 126, 234, 0.6)',
                borderColor: 'rgba(102, 126, 234, 1)',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: true },
                title: {
                    display: true,
                    text: 'Pitch Distribution (Most Common Notes)'
                }
            },
            scales: {
                y: { 
                    beginAtZero: true,
                    title: { display: true, text: 'Occurrences' }
                },
                x: {
                    title: { display: true, text: 'Musical Notes' }
                }
            }
        }
    });
    
    const avgPitch = pitches.reduce((a, b) => a + b, 0) / pitches.length;
    const avgNote = audioAnalyzer.midiToNoteName(audioAnalyzer.frequencyToMidiNote(avgPitch));
    const pitchStdDev = Math.sqrt(pitches.reduce((sum, p) => sum + Math.pow(p - avgPitch, 2), 0) / pitches.length);
    
    pitchInfo.innerHTML = `
        <p><strong>Average Pitch:</strong> ${avgPitch.toFixed(2)} Hz (${avgNote})</p>
        <p><strong>Pitch Range:</strong> ${Math.min(...pitches).toFixed(2)} - ${Math.max(...pitches).toFixed(2)} Hz</p>
        <p><strong>Most Common Note:</strong> ${sortedNotes[0] ? audioAnalyzer.midiToNoteName(parseInt(sortedNotes[0][0])) : 'N/A'}</p>
        <p><strong>Pitch Variation:</strong> ${pitchStdDev.toFixed(2)} Hz (${pitchStdDev > 50 ? 'High' : pitchStdDev > 20 ? 'Moderate' : 'Low'} variability)</p>
        <p><strong>Total Pitches Detected:</strong> ${pitches.length}</p>
    `;
}

function displayRhythmAnalysis(rhythmAnalysis) {
    const chartElement = document.getElementById('rhythm-chart');
    const rhythmInfo = document.getElementById('rhythm-info');
    
    if (!chartElement) {
        console.error('rhythm-chart element not found');
        return;
    }
    
    const ctx = chartElement.getContext('2d');
    
    // Destroy existing chart
    if (rhythmChart) rhythmChart.destroy();
    
    rhythmChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: rhythmAnalysis.intervals.slice(0, 30).map((_, i) => `${i + 1}`),
            datasets: [{
                label: 'Inter-onset Intervals (ms)',
                data: rhythmAnalysis.intervals.slice(0, 30),
                borderColor: 'rgba(118, 75, 162, 1)',
                backgroundColor: 'rgba(118, 75, 162, 0.2)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: true },
                title: {
                    display: true,
                    text: 'Rhythm Pattern (First 30 Beats)'
                }
            },
            scales: {
                y: {
                    title: { display: true, text: 'Interval Duration (ms)' }
                },
                x: {
                    title: { display: true, text: 'Beat Number' }
                }
            }
        }
    });
    
    const avgInterval = rhythmAnalysis.intervals.reduce((a, b) => a + b, 0) / rhythmAnalysis.intervals.length;
    const timeSignature = rhythmAnalysis.tempo > 150 ? '2/4 or 6/8' : rhythmAnalysis.tempo > 100 ? '4/4' : '3/4 or 6/8';
    
    // Enhanced rhythm information with ML features
    const complexityLabel = rhythmAnalysis.temporalComplexity > 0.7 ? 'Very Complex' :
                           rhythmAnalysis.temporalComplexity > 0.5 ? 'Complex' :
                           rhythmAnalysis.temporalComplexity > 0.3 ? 'Moderate' : 'Simple';
    
    const percussivenessLabel = rhythmAnalysis.percussiveness > 0.15 ? 'Highly Percussive' :
                                rhythmAnalysis.percussiveness > 0.08 ? 'Moderately Percussive' : 'Melodic';
    
    rhythmInfo.innerHTML = `
        <p><strong>Estimated Tempo:</strong> ${rhythmAnalysis.tempo} BPM</p>
        <p><strong>Rhythm Regularity:</strong> ${(rhythmAnalysis.regularity * 100).toFixed(1)}% (${rhythmAnalysis.regularity > 0.8 ? 'Very Regular' : rhythmAnalysis.regularity > 0.6 ? 'Moderate' : 'Irregular'})</p>
        <p><strong>Detected Beats:</strong> ${rhythmAnalysis.peakCount}</p>
        <p><strong>Average Beat Interval:</strong> ${avgInterval.toFixed(2)} ms</p>
        <p><strong>Likely Time Signature:</strong> ${timeSignature}</p>
        <p><strong>Rhythmic Complexity:</strong> ${complexityLabel} (${(rhythmAnalysis.temporalComplexity * 100).toFixed(1)}%)</p>
        ${rhythmAnalysis.polyrhythmic ? `<p><strong>⚡ Polyrhythmic Pattern Detected:</strong> ${rhythmAnalysis.polyrhythmRatio}</p>` : ''}
        <p><strong>Percussiveness:</strong> ${percussivenessLabel} (ZCR: ${(rhythmAnalysis.percussiveness * 100).toFixed(2)}%)</p>
        <p style="margin-top: 10px; padding: 10px; background: #f5f5f5; border-radius: 4px; font-size: 0.9em;">
            <strong>Analysis:</strong> ${rhythmAnalysis.regularity > 0.7 ? 'Steady, metronomic rhythm suitable for dance or marching.' : rhythmAnalysis.polyrhythmic ? 'Complex polyrhythmic structure common in West African and Latin American music.' : 'Irregular rhythm pattern, possibly rubato or free-time performance.'}
        </p>
    `;
}

function displayMusicalInsights(rhythmAnalysis, scaleAnalysis, spectralAnalysis) {
    const insightsDiv = document.getElementById('cultural-insights');
    
    // Find similar cultures based on musical characteristics
    const allCultures = getAllCultures();
    let culturalMatches = [];
    
    allCultures.forEach(culture => {
        let score = 0;
        const characteristics = culture.characteristics;
        
        // Compare tempo
        const tempoRange = characteristics.tempo.split('-').map(t => parseInt(t));
        const avgTempo = (tempoRange[0] + tempoRange[1]) / 2;
        const tempoDiff = Math.abs(rhythmAnalysis.tempo - avgTempo);
        
        if (tempoDiff < 15) score += 3;
        else if (tempoDiff < 30) score += 2;
        else if (tempoDiff < 50) score += 1;
        
        // Compare rhythm characteristics
        if (rhythmAnalysis.regularity > 0.7 && characteristics.rhythm.toLowerCase().includes('steady')) score += 2;
        if (rhythmAnalysis.regularity > 0.7 && characteristics.rhythm.toLowerCase().includes('regular')) score += 2;
        if (rhythmAnalysis.polyrhythmic && characteristics.rhythm.toLowerCase().includes('complex')) score += 3;
        if (rhythmAnalysis.polyrhythmic && characteristics.rhythm.toLowerCase().includes('polyrhythmic')) score += 3;
        
        // Compare scale types
        if (scaleAnalysis.scale.includes('Pentatonic') && characteristics.scales.toLowerCase().includes('pentatonic')) score += 3;
        if (scaleAnalysis.scale.includes('Minor') && characteristics.scales.toLowerCase().includes('minor')) score += 2;
        if (scaleAnalysis.scale.includes('Major') && characteristics.scales.toLowerCase().includes('major')) score += 2;
        
        if (score > 0) {
            culturalMatches.push({ culture, score });
        }
    });
    
    culturalMatches.sort((a, b) => b.score - a.score);
    const topMatches = culturalMatches.slice(0, 5);
    
    // Determine musical characteristics without cultural presumptions
    const tempoCategory = rhythmAnalysis.tempo < 60 ? 'Very Slow (Grave/Largo)' :
                         rhythmAnalysis.tempo < 80 ? 'Slow (Adagio/Andante)' :
                         rhythmAnalysis.tempo < 108 ? 'Moderate (Moderato)' :
                         rhythmAnalysis.tempo < 140 ? 'Fast (Allegro)' : 'Very Fast (Presto)';
    
    const timbreCategory = spectralAnalysis.brightness > 0.6 ? 'Bright/Shimmering' :
                          spectralAnalysis.brightness > 0.4 ? 'Balanced' : 'Dark/Warm';
    
    const rhythmicCharacter = rhythmAnalysis.polyrhythmic ? 'Polyrhythmic (Multiple simultaneous patterns)' :
                             rhythmAnalysis.regularity > 0.8 ? 'Steady/Metronomic' :
                             rhythmAnalysis.regularity > 0.5 ? 'Moderately Regular' : 'Fluid/Rubato';
    
    // Scale family information
    const scaleFamily = scaleAnalysis.scale.includes('Pentatonic') ? 'Pentatonic (5-note scales)' :
                       scaleAnalysis.scale.includes('Major') || scaleAnalysis.scale.includes('Minor') ? 'Diatonic (7-note scales)' :
                       scaleAnalysis.scale.includes('Blues') ? 'Blues-influenced' :
                       scaleAnalysis.scale.includes('Chromatic') ? 'Chromatic (12-tone)' :
                       scaleAnalysis.scale.includes('Whole Tone') ? 'Whole Tone (6-note symmetrical)' : 'Modal';
    
    // Advanced musical analysis
    const energyLevel = spectralAnalysis.rolloff > 3000 ? 'High Energy' : 
                       spectralAnalysis.rolloff > 1500 ? 'Moderate Energy' : 'Low Energy';
    
    const texturalDensity = spectralAnalysis.brightness > 0.5 && rhythmAnalysis.percussiveness > 0.1 ? 'Dense/Complex' :
                           spectralAnalysis.brightness < 0.3 && rhythmAnalysis.percussiveness < 0.08 ? 'Sparse/Minimal' : 'Moderate';
    
    // Musical form suggestions
    const suggestedUses = getSuggestedMusicalUses(rhythmAnalysis, scaleAnalysis, spectralAnalysis);
    
    // Cultural comparison section
    let culturalComparisonHTML = '';
    if (topMatches.length > 0) {
        culturalComparisonHTML = `
            <div style="margin-bottom: 20px; padding: 15px; background: #e8f5e9; border-radius: 8px; border-left: 4px solid #4caf50;">
                <h4 style="margin-top: 0;">🌍 Similar Musical Cultures</h4>
                <p style="margin: 0 0 15px; font-size: 0.9em; color: #2e7d32;">
                    Based on tempo, rhythm, and scale characteristics, your audio shares similarities with:
                </p>
                ${topMatches.map((match, i) => `
                    <div style="margin: 10px 0; padding: 12px; background: white; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                        <strong style="font-size: 1.1em;">${i + 1}. ${match.culture.emoji} ${match.culture.name}</strong>
                        <p style="margin: 5px 0 0; font-size: 0.85em; color: #555;">
                            <strong>Match Score:</strong> ${match.score}/10 | 
                            <strong>Tempo:</strong> ${match.culture.characteristics.tempo} BPM | 
                            <strong>Rhythm:</strong> ${match.culture.characteristics.rhythm}
                        </p>
                        <p style="margin: 5px 0 0; font-size: 0.85em; color: #666;">
                            <strong>Scales:</strong> ${match.culture.characteristics.scales}
                        </p>
                    </div>
                `).join('')}
                <button class="btn-secondary" style="margin-top: 10px;" onclick="document.querySelector('[data-tab=\\'explore\\']').click(); setTimeout(() => document.getElementById('explore-tab').scrollIntoView({behavior: 'smooth'}), 100);">
                    🔍 Explore These Cultures
                </button>
            </div>
        `;
    }
    
    insightsDiv.innerHTML = `
        ${culturalComparisonHTML}
        
        <div style="margin-bottom: 20px; padding: 15px; background: #f0f4ff; border-radius: 8px; border-left: 4px solid #667eea;">
            <h4 style="margin-top: 0;">🎼 Musical Scale & Tonality</h4>
            <p><strong style="font-size: 1.3em; color: #667eea;">${scaleAnalysis.scale}</strong></p>
            <p style="margin: 5px 0; font-size: 0.9em;">
                <strong>Detection Confidence:</strong> ${(scaleAnalysis.confidence * 100).toFixed(1)}% 
                ${scaleAnalysis.confidence > 0.7 ? '✓ High Confidence' : scaleAnalysis.confidence > 0.4 ? '~ Moderate Confidence' : '? Low Confidence - Ambiguous Tonality'}
            </p>
            <p style="margin: 5px 0; font-size: 0.9em;">
                <strong>Scale Family:</strong> ${scaleFamily}
            </p>
        </div>
        
        <h4>🎵 Comprehensive Musical Analysis</h4>
        
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px; margin-top: 15px;">
            <div style="padding: 15px; background: #fff3e0; border-radius: 8px; border-left: 4px solid #ff9800;">
                <h5 style="margin: 0 0 10px 0; color: #e65100;">⏱️ Tempo & Rhythm</h5>
                <p style="margin: 5px 0; font-size: 0.9em;"><strong>Tempo:</strong> ${rhythmAnalysis.tempo} BPM</p>
                <p style="margin: 5px 0; font-size: 0.9em;"><strong>Category:</strong> ${tempoCategory}</p>
                <p style="margin: 5px 0; font-size: 0.9em;"><strong>Character:</strong> ${rhythmicCharacter}</p>
                <p style="margin: 5px 0; font-size: 0.9em;"><strong>Regularity:</strong> ${(rhythmAnalysis.regularity * 100).toFixed(0)}%</p>
                ${rhythmAnalysis.polyrhythmic ? `<p style="margin: 5px 0; font-size: 0.9em; color: #d84315;"><strong>⚡ Polyrhythm:</strong> ${rhythmAnalysis.polyrhythmRatio}</p>` : ''}
            </div>
            
            <div style="padding: 15px; background: #f3e5f5; border-radius: 8px; border-left: 4px solid #9c27b0;">
                <h5 style="margin: 0 0 10px 0; color: #6a1b9a;">🎨 Timbre & Texture</h5>
                <p style="margin: 5px 0; font-size: 0.9em;"><strong>Timbral Quality:</strong> ${timbreCategory}</p>
                <p style="margin: 5px 0; font-size: 0.9em;"><strong>Brightness:</strong> ${(spectralAnalysis.brightness * 100).toFixed(0)}%</p>
                <p style="margin: 5px 0; font-size: 0.9em;"><strong>Spectral Centroid:</strong> ${spectralAnalysis.centroid.toFixed(0)} Hz</p>
                <p style="margin: 5px 0; font-size: 0.9em;"><strong>Energy Distribution:</strong> ${energyLevel}</p>
                <p style="margin: 5px 0; font-size: 0.9em;"><strong>Texture:</strong> ${texturalDensity}</p>
            </div>
            
            <div style="padding: 15px; background: #e8f5e9; border-radius: 8px; border-left: 4px solid #4caf50;">
                <h5 style="margin: 0 0 10px 0; color: #2e7d32;">🔊 Percussive Analysis</h5>
                <p style="margin: 5px 0; font-size: 0.9em;"><strong>Percussiveness:</strong> ${(rhythmAnalysis.percussiveness * 100).toFixed(1)}%</p>
                <p style="margin: 5px 0; font-size: 0.9em;"><strong>Character:</strong> ${rhythmAnalysis.percussiveness > 0.15 ? 'Highly Percussive' : rhythmAnalysis.percussiveness > 0.08 ? 'Moderately Percussive' : 'Melodic/Sustained'}</p>
                <p style="margin: 5px 0; font-size: 0.9em;"><strong>Rhythmic Complexity:</strong> ${(rhythmAnalysis.temporalComplexity * 100).toFixed(0)}%</p>
                <p style="margin: 5px 0; font-size: 0.9em;"><strong>Beat Count:</strong> ${rhythmAnalysis.peakCount} onsets</p>
            </div>
        </div>
        
        <div style="margin-top: 20px; padding: 15px; background: #fff9e6; border-radius: 8px; border-left: 4px solid #ffc107;">
            <h4 style="margin-top: 0;">📚 About This Scale</h4>
            ${getScaleDescription(scaleAnalysis.scale)}
        </div>
        
        <div style="margin-top: 20px; padding: 15px; background: #e1f5fe; border-radius: 8px; border-left: 4px solid #03a9f4;">
            <h4 style="margin-top: 0;">🎭 Musical Context & Applications</h4>
            ${suggestedUses}
        </div>
        
        <div style="margin-top: 20px; padding: 12px; background: #f5f5f5; border-radius: 8px; font-size: 0.9em; color: #666;">
            <p style="margin: 0;"><strong>💡 Interpretation Note:</strong> This analysis identifies theoretical musical structures (scales, rhythmic patterns, timbral qualities) and shows cultures with similar characteristics. Musical elements transcend borders and appear in diverse global traditions. Use this as a starting point for deeper exploration.</p>
        </div>
    `;
}

function getSuggestedMusicalUses(rhythmAnalysis, scaleAnalysis, spectralAnalysis) {
    let suggestions = [];
    
    // Tempo-based suggestions
    if (rhythmAnalysis.tempo < 70) {
        suggestions.push('Ballads, meditative music, ambient soundscapes');
    } else if (rhythmAnalysis.tempo < 100) {
        suggestions.push('Folk songs, blues, soul, downtempo');
    } else if (rhythmAnalysis.tempo < 130) {
        suggestions.push('Pop, rock, funk, moderate dance music');
    } else {
        suggestions.push('Uptempo dance, electronic music, fast folk traditions');
    }
    
    // Scale-based suggestions
    if (scaleAnalysis.scale.includes('Pentatonic')) {
        suggestions.push('Improvisation-friendly, common in blues, rock, and traditional music worldwide');
    } else if (scaleAnalysis.scale.includes('Blues')) {
        suggestions.push('Blues, jazz, rock, gospel music');
    } else if (scaleAnalysis.scale.includes('Dorian') || scaleAnalysis.scale.includes('Mixolydian')) {
        suggestions.push('Jazz, fusion, modal jazz, contemporary folk');
    } else if (scaleAnalysis.scale.includes('Phrygian')) {
        suggestions.push('Flamenco, metal, Mediterranean-influenced music');
    } else if (scaleAnalysis.scale.includes('Minor')) {
        suggestions.push('Classical compositions, emotional/dramatic music, film scores');
    }
    
    // Rhythm-based suggestions
    if (rhythmAnalysis.polyrhythmic) {
        suggestions.push('Complex rhythmic music, progressive styles, polyrhythmic traditions');
    } else if (rhythmAnalysis.regularity > 0.8) {
        suggestions.push('Dance music, marching music, metronomic compositions');
    } else if (rhythmAnalysis.regularity < 0.5) {
        suggestions.push('Free-form jazz, rubato classical pieces, expressive performances');
    }
    
    // Timbre-based suggestions
    if (spectralAnalysis.brightness > 0.6) {
        suggestions.push('Bright instrumentation (cymbals, strings, synths)');
    } else {
        suggestions.push('Warm instrumentation (bass, woodwinds, mellow tones)');
    }
    
    return `
        <ul style="margin: 10px 0; padding-left: 20px; line-height: 1.8;">
            ${suggestions.map(s => `<li style="margin: 8px 0;">${s}</li>`).join('')}
        </ul>
        <p style="margin: 15px 0 0 0; padding: 10px; background: rgba(3, 169, 244, 0.1); border-radius: 4px; font-size: 0.9em;">
            <strong>Suggested Exploration:</strong> Listen to examples across different genres and cultures that share these characteristics to discover the universality and uniqueness of musical elements.
        </p>
    `;
}

function getScaleDescription(scaleName) {
    const descriptions = {
        'Major (Western)': '<p>A 7-note diatonic scale with a characteristic bright, happy sound. Used extensively across many musical traditions worldwide.</p>',
        'Minor (Western)': '<p>A 7-note diatonic scale with a characteristic darker, more melancholic quality. Common in European classical, jazz, and popular music.</p>',
        'Harmonic Minor': '<p>A minor scale with a raised 7th degree, creating an augmented 2nd interval. Creates an exotic sound used in classical, Middle Eastern, and flamenco music.</p>',
        'Pentatonic Major': '<p>A 5-note scale found in traditional music across East Asia, Celtic traditions, blues, and many other cultures worldwide.</p>',
        'Pentatonic Minor': '<p>A 5-note scale common in blues, rock, folk music from various traditions, and traditional music of many cultures.</p>',
        'Blues': '<p>A 6-note scale incorporating "blue notes" (flattened 3rd, 5th, and 7th). Fundamental to blues, jazz, and rock music.</p>',
        'Dorian': '<p>A modal scale with a minor 3rd and major 6th. Used in Celtic music, jazz, rock, and traditional music from various regions.</p>',
        'Phrygian': '<p>A modal scale with a distinctive flattened 2nd degree. Found in Spanish flamenco and traditional music from Mediterranean and Middle Eastern regions.</p>',
        'Lydian': '<p>A modal scale with a raised 4th degree, creating a dreamy, floating quality. Used in jazz, film scores, and various folk traditions.</p>',
        'Mixolydian': '<p>A modal scale with a major quality and flattened 7th. Common in rock, folk, and traditional music from many cultures.</p>',
        'Hirajoshi (Japanese)': '<p>A pentatonic scale traditionally used in Japanese music. Creates a characteristic sound associated with koto and shakuhachi music.</p>',
        'In Sen (Japanese)': '<p>A pentatonic scale used in traditional Japanese music with a characteristic haunting quality.</p>',
        'Raga Bhairav (Indian)': '<p>A morning raga in Hindustani classical music, characterized by specific ascending and descending patterns.</p>',
        'Raga Kafi (Indian)': '<p>A raga in Hindustani classical music, often associated with devotional and folk music.</p>',
        'Maqam Hijaz (Arabic)': '<p>A mode used in Arabic music characterized by an augmented 2nd interval, creating a distinctive Middle Eastern sound.</p>',
        'Whole Tone': '<p>A 6-note scale made entirely of whole steps. Used extensively in impressionist music and creates an ambiguous, floating tonality.</p>',
        'Chromatic': '<p>All 12 pitches of the Western chromatic scale. Used in atonal, serial, and highly chromatic tonal music.</p>'
    };
    
    return descriptions[scaleName] || '<p>An interesting scale structure with unique intervallic relationships.</p>';
}

// Spectral Analysis Function
function analyzeSpectrum(channelData, sampleRate) {
    const fftSize = 2048;
    const spectrum = [];
    
    // Analyze multiple windows
    let windows = 0;
    const maxWindows = 50; // Reduced from 200 to prevent freeze
    for (let i = 0; i < channelData.length - fftSize; i += fftSize * 32) {
        const window = channelData.slice(i, i + fftSize);
        const fft = performFFT(window);
        spectrum.push(fft);
        windows++;
        if (windows >= maxWindows) break;
    }
    
    // Calculate average spectrum
    const avgSpectrum = new Array(fftSize / 2).fill(0);
    spectrum.forEach(spec => {
        for (let i = 0; i < spec.length; i++) {
            avgSpectrum[i] += spec[i];
        }
    });
    avgSpectrum.forEach((val, i, arr) => arr[i] = val / spectrum.length);
    
    // Calculate spectral features
    const spectralCentroid = calculateSpectralCentroid(avgSpectrum, sampleRate);
    const spectralRolloff = calculateSpectralRolloff(avgSpectrum, sampleRate);
    const brightness = spectralCentroid / (sampleRate / 2);
    
    return {
        spectrum: avgSpectrum,
        centroid: spectralCentroid,
        rolloff: spectralRolloff,
        brightness: brightness
    };
}

function performFFT(data) {
    // Simple magnitude spectrum approximation
    const magnitudes = [];
    for (let i = 0; i < data.length / 2; i++) {
        magnitudes.push(Math.abs(data[i]));
    }
    return magnitudes;
}

function calculateSpectralCentroid(spectrum, sampleRate) {
    let weightedSum = 0;
    let sum = 0;
    for (let i = 0; i < spectrum.length; i++) {
        const freq = (i * sampleRate) / (spectrum.length * 2);
        weightedSum += freq * spectrum[i];
        sum += spectrum[i];
    }
    return sum > 0 ? weightedSum / sum : 0;
}

function calculateSpectralRolloff(spectrum, sampleRate) {
    const totalEnergy = spectrum.reduce((a, b) => a + b, 0);
    const threshold = totalEnergy * 0.85;
    let cumulativeEnergy = 0;
    for (let i = 0; i < spectrum.length; i++) {
        cumulativeEnergy += spectrum[i];
        if (cumulativeEnergy >= threshold) {
            return (i * sampleRate) / (spectrum.length * 2);
        }
    }
    return 0;
}

function displaySpectralAnalysis(spectralAnalysis) {
    const chartElement = document.getElementById('spectral-chart');
    const spectralInfo = document.getElementById('spectral-info');
    
    if (!chartElement) {
        console.error('spectral-chart element not found');
        return;
    }
    
    const ctx = chartElement.getContext('2d');
    
    // Destroy existing chart
    if (spectralChart) spectralChart.destroy();
    
    // Prepare data for visualization (downsample for readability)
    const downsampleFactor = 8;
    const labels = [];
    const data = [];
    for (let i = 0; i < spectralAnalysis.spectrum.length; i += downsampleFactor) {
        labels.push(`${(i * 22050 / spectralAnalysis.spectrum.length).toFixed(0)} Hz`);
        data.push(spectralAnalysis.spectrum[i]);
    }
    
    spectralChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels.slice(0, 50),
            datasets: [{
                label: 'Spectral Energy',
                data: data.slice(0, 50),
                borderColor: 'rgba(76, 175, 80, 1)',
                backgroundColor: 'rgba(76, 175, 80, 0.2)',
                tension: 0.3,
                fill: true
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: true },
                title: {
                    display: true,
                    text: 'Frequency Spectrum Analysis'
                }
            },
            scales: {
                y: {
                    title: { display: true, text: 'Magnitude' }
                },
                x: {
                    title: { display: true, text: 'Frequency' }
                }
            }
        }
    });
    
    const timbre = spectralAnalysis.brightness > 0.6 ? 'Bright' : spectralAnalysis.brightness > 0.4 ? 'Balanced' : 'Dark';
    
    spectralInfo.innerHTML = `
        <p><strong>Spectral Centroid:</strong> ${spectralAnalysis.centroid.toFixed(2)} Hz</p>
        <p><strong>Spectral Rolloff:</strong> ${spectralAnalysis.rolloff.toFixed(2)} Hz (85% energy threshold)</p>
        <p><strong>Brightness:</strong> ${(spectralAnalysis.brightness * 100).toFixed(1)}%</p>
        <p><strong>Timbre Character:</strong> ${timbre}</p>
        <p><strong>Analysis:</strong> ${spectralAnalysis.brightness > 0.5 ? 'High-frequency content suggests presence of cymbals, strings, or bright instruments' : 'Low-frequency dominant, suggests drums, bass, or darker timbres'}</p>
    `;
}

// Download Functions - Using event delegation to avoid duplicate listeners
let downloadListenersInitialized = false;

function setupDownloadButtons() {
    if (downloadListenersInitialized) return; // Only setup once
    
    document.addEventListener('click', (e) => {
        if (e.target?.id === 'download-pitch-chart') {
            downloadChart(pitchChart, 'pitch-analysis.png');
        } else if (e.target?.id === 'download-rhythm-chart') {
            downloadChart(rhythmChart, 'rhythm-analysis.png');
        } else if (e.target?.id === 'download-spectral-chart') {
            downloadChart(spectralChart, 'spectral-analysis.png');
        } else if (e.target?.id === 'download-analysis-data') {
            downloadJSON(currentAnalysisData, 'music-analysis-data.json');
        } else if (e.target?.id === 'download-full-report') {
            generateAnalysisReport();
        }
    });
    
    downloadListenersInitialized = true;
}

function downloadChart(chart, filename) {
    if (!chart) return;
    const url = chart.toBase64Image();
    const link = document.createElement('a');
    link.download = filename;
    link.href = url;
    link.click();
}

function generateAnalysisReport() {
    if (!currentAnalysisData) return;
    
    const reportText = `
MUSIC ANALYSIS REPORT
Generated: ${new Date().toLocaleString()}
Analyzed by: Ethnomusicology Explorer
Created by: Rohan R. Sagar

═══════════════════════════════════════════════════

FILE INFORMATION
Duration: ${currentAnalysisData.duration.toFixed(2)} seconds
Sample Rate: ${currentAnalysisData.sampleRate} Hz

═══════════════════════════════════════════════════

RHYTHM ANALYSIS
Tempo: ${currentAnalysisData.rhythm.tempo} BPM
Rhythm Regularity: ${(currentAnalysisData.rhythm.regularity * 100).toFixed(1)}%
Detected Beats: ${currentAnalysisData.rhythm.peakCount}
Pattern Complexity: ${currentAnalysisData.rhythm.regularity < 0.6 ? 'Complex (Polyrhythmic)' : 'Simple'}

═══════════════════════════════════════════════════

PITCH ANALYSIS
Total Pitches Detected: ${currentAnalysisData.pitches.length}
Average Pitch: ${(currentAnalysisData.pitches.reduce((a,b)=>a+b,0)/currentAnalysisData.pitches.length).toFixed(2)} Hz
Pitch Range: ${Math.min(...currentAnalysisData.pitches).toFixed(2)} - ${Math.max(...currentAnalysisData.pitches).toFixed(2)} Hz

═══════════════════════════════════════════════════

SPECTRAL ANALYSIS
Spectral Centroid: ${currentAnalysisData.spectral.centroid.toFixed(2)} Hz
Spectral Rolloff: ${currentAnalysisData.spectral.rolloff.toFixed(2)} Hz
Brightness: ${(currentAnalysisData.spectral.brightness * 100).toFixed(1)}%
Timbre: ${currentAnalysisData.spectral.brightness > 0.6 ? 'Bright' : currentAnalysisData.spectral.brightness > 0.4 ? 'Balanced' : 'Dark'}

═══════════════════════════════════════════════════

For more information, visit: https://www.digitalheritagegy.com
    `.trim();
    
    const blob = new Blob([reportText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = 'music-analysis-report.txt';
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
}

function downloadLessonPlan(title, lesson) {
    const doc = new jsPDF();
    let yPosition = 20;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    const maxWidth = pageWidth - (margin * 2);
    
    // Title
    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.text(title, margin, yPosition);
    yPosition += 12;
    
    // Metadata
    doc.setFontSize(11);
    doc.setFont(undefined, 'normal');
    doc.text(`Grade Level: ${lesson.grade} | Duration: ${lesson.duration}`, margin, yPosition);
    yPosition += 10;
    
    // Add a line
    doc.setDrawColor(102, 126, 234);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 8;
    
    // Learning Objectives
    doc.setFontSize(13);
    doc.setFont(undefined, 'bold');
    doc.text('Learning Objectives', margin, yPosition);
    yPosition += 7;
    
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    lesson.objectives.forEach((obj, i) => {
        const wrapped = doc.splitTextToSize(`${i + 1}. ${obj}`, maxWidth - 5);
        doc.text(wrapped, margin + 5, yPosition);
        yPosition += wrapped.length * 4 + 2;
        
        if (yPosition > pageHeight - margin) {
            doc.addPage();
            yPosition = margin;
        }
    });
    
    yPosition += 3;
    
    // Activities
    doc.setFontSize(13);
    doc.setFont(undefined, 'bold');
    doc.text('Activities', margin, yPosition);
    yPosition += 7;
    
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    lesson.activities.forEach((act, i) => {
        const wrapped = doc.splitTextToSize(`${i + 1}. ${act}`, maxWidth - 5);
        doc.text(wrapped, margin + 5, yPosition);
        yPosition += wrapped.length * 4 + 2;
        
        if (yPosition > pageHeight - margin) {
            doc.addPage();
            yPosition = margin;
        }
    });
    
    yPosition += 3;
    
    // Assessment
    doc.setFontSize(13);
    doc.setFont(undefined, 'bold');
    doc.text('Assessment', margin, yPosition);
    yPosition += 7;
    
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    const assessmentWrapped = doc.splitTextToSize(lesson.assessment, maxWidth);
    doc.text(assessmentWrapped, margin, yPosition);
    yPosition += assessmentWrapped.length * 4 + 5;
    
    if (yPosition > pageHeight - margin) {
        doc.addPage();
        yPosition = margin;
    }
    
    // Extensions
    doc.setFontSize(13);
    doc.setFont(undefined, 'bold');
    doc.text('Extensions', margin, yPosition);
    yPosition += 7;
    
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    const extensionsWrapped = doc.splitTextToSize(lesson.extensions, maxWidth);
    doc.text(extensionsWrapped, margin, yPosition);
    
    // Footer
    const pageCount = doc.getNumberOfPages();
    doc.setFontSize(9);
    doc.setFont(undefined, 'italic');
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.text(`Created with Computational Ethnomusicology App | Digital Heritage GY | Page ${i}/${pageCount}`, 
                 margin, pageHeight - 10);
    }
    
    // Download
    doc.save(`lesson-${title.toLowerCase().replace(/\s+/g, '-')}.pdf`);
}

// Download student worksheet (simplified, student-facing)
function downloadWorksheet(title, lesson) {
    const doc = new jsPDF();
    let yPosition = 20;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    const maxWidth = pageWidth - (margin * 2);
    
    // Header
    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text('Student Worksheet', margin, yPosition);
    yPosition += 10;
    
    doc.setFontSize(14);
    doc.text(title, margin, yPosition);
    yPosition += 8;
    
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text(`Name: ___________________________     Date: ___________`, margin, yPosition);
    yPosition += 10;
    
    // Line
    doc.setDrawColor(102, 126, 234);
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 8;
    
    // Objectives (simplified)
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('What You Will Learn:', margin, yPosition);
    yPosition += 6;
    
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    lesson.objectives.slice(0, 3).forEach((obj, i) => {
        const wrapped = doc.splitTextToSize(`• ${obj}`, maxWidth - 5);
        doc.text(wrapped, margin + 3, yPosition);
        yPosition += wrapped.length * 4 + 2;
        
        if (yPosition > pageHeight - margin) {
            doc.addPage();
            yPosition = margin;
        }
    });
    
    yPosition += 5;
    
    // Practice Activities (student-facing)
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('Practice Activities:', margin, yPosition);
    yPosition += 6;
    
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    
    // Add 3 simple practice questions
    const practices = [
        'Listen to the music sample. What instruments do you hear?',
        'Draw or describe the rhythm pattern you noticed.',
        'Write down 2-3 interesting facts you learned about this culture.'
    ];
    
    practices.forEach((practice, i) => {
        if (yPosition > pageHeight - 40) {
            doc.addPage();
            yPosition = margin;
        }
        
        doc.setFont(undefined, 'bold');
        doc.text(`${i + 1}. ${practice}`, margin, yPosition);
        yPosition += 6;
        
        doc.setFont(undefined, 'normal');
        // Add lines for answers
        for (let line = 0; line < 4; line++) {
            doc.line(margin + 3, yPosition, pageWidth - margin, yPosition);
            yPosition += 6;
        }
        yPosition += 3;
    });
    
    // Reflection section
    if (yPosition > pageHeight - 40) {
        doc.addPage();
        yPosition = margin;
    }
    
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text('Reflection:', margin, yPosition);
    yPosition += 6;
    
    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.text('What was the most interesting thing you learned today?', margin, yPosition);
    yPosition += 6;
    
    for (let line = 0; line < 5; line++) {
        doc.line(margin + 3, yPosition, pageWidth - margin, yPosition);
        yPosition += 6;
    }
    
    // Footer
    const pageCount = doc.getNumberOfPages();
    doc.setFontSize(9);
    doc.setFont(undefined, 'italic');
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.text(`Ethnomusicology Explorer | Page ${i}/${pageCount}`, 
                 margin, pageHeight - 10);
    }
    
    // Download
    doc.save(`worksheet-${title.toLowerCase().replace(/\s+/g, '-')}.pdf`);
}

// Classroom Mode: UI and audio volume cap
function initializeClassroomMode() {
    const toggle = document.getElementById('classroom-mode-toggle');
    const enabled = localStorage.getItem('classroomMode') === 'true';
    applyClassroomMode(enabled);
    if (toggle) {
        toggle.textContent = enabled ? '🏫 On' : '🏫';
        toggle.addEventListener('click', () => {
            const next = !document.body.classList.contains('classroom-mode');
            applyClassroomMode(next);
            localStorage.setItem('classroomMode', String(next));
            toggle.textContent = next ? '🏫 On' : '🏫';
        });
    }
}

function applyClassroomMode(enabled) {
    if (enabled) {
        document.body.classList.add('classroom-mode');
        if (window.__MASTER_GAIN) window.__MASTER_GAIN.gain.value = 0.18;
    } else {
        document.body.classList.remove('classroom-mode');
        if (window.__MASTER_GAIN) window.__MASTER_GAIN.gain.value = 0.35;
    }
}

// Games
function initializeGames() {
    initializeRhythmGame();
    initializeQuiz();
    initializeScaleExplorer();
}

function initializeRhythmGame() {
    const startBtn = document.getElementById('start-rhythm-game');
    
    startBtn.addEventListener('click', () => {
        const gameDiv = document.getElementById('rhythm-game');
        gameDiv.style.display = 'block';
        startBtn.style.display = 'none';
        trackDashboardActivity('game');
        
        // Simple rhythm game logic
        document.getElementById('rhythm-score').innerHTML = '<p>Tap the pads to create rhythms! 🎵</p>';
    });
    
    const pads = document.querySelectorAll('.rhythm-pad');
    
    pads.forEach((pad, index) => {
        pad.addEventListener('click', () => {
            const frequencies = [100, 200, 400, 600];
            playNote(frequencies[index], audioContext.currentTime, 0.2);
            pad.style.transform = 'scale(0.9)';
            setTimeout(() => pad.style.transform = 'scale(1)', 100);
        });
    });
}

function initializeQuiz() {
    const startBtn = document.getElementById('start-quiz');
    const quizContainer = document.getElementById('quiz-container');
    
    const questions = [
        {
            question: 'Which instrument is central to Indian classical music?',
            options: ['Sitar', 'Guitar', 'Piano', 'Trumpet'],
            correct: 0
        },
        {
            question: 'What is a pentatonic scale?',
            options: ['3 notes', '5 notes', '7 notes', '12 notes'],
            correct: 1
        },
        {
            question: 'The kora is from which region?',
            options: ['East Asia', 'West Africa', 'Europe', 'South America'],
            correct: 1
        }
    ];
    
    let currentQuestion = 0;
    let score = 0;
    
    startBtn.addEventListener('click', () => {
        quizContainer.style.display = 'block';
        startBtn.style.display = 'none';
        trackDashboardActivity('quiz');
        showQuestion();
    });
    
    function showQuestion() {
        if (currentQuestion >= questions.length) {
            quizContainer.innerHTML = `<h3>Quiz Complete! Score: ${score}/${questions.length}</h3>`;
            return;
        }
        
        const q = questions[currentQuestion];
        quizContainer.innerHTML = `
            <h4>${q.question}</h4>
            ${q.options.map((opt, i) => `
                <button class="btn-primary" style="display: block; margin: 10px 0; width: 100%;" data-answer="${i}">
                    ${opt}
                </button>
            `).join('')}
        `;
        
        quizContainer.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const answer = parseInt(e.target.dataset.answer);
                if (answer === q.correct) {
                    score++;
                    e.target.style.background = 'green';
                } else {
                    e.target.style.background = 'red';
                }
                setTimeout(() => {
                    currentQuestion++;
                    showQuestion();
                }, 1000);
            });
        });
    }
}

function initializeScaleExplorer() {
    const playScaleBtn = document.getElementById('play-scale');
    const scaleSelect = document.getElementById('scale-select');
    const scaleInfo = document.getElementById('scale-info');
    
    // Replace native select with custom dropdown for better cross-browser styling
    if (scaleSelect) {
        const options = Array.from(scaleSelect.options).map(opt => ({ value: opt.value, label: opt.text }));
        const customDropdown = document.createElement('div');
        customDropdown.className = 'custom-dropdown';
        customDropdown.innerHTML = `
            <button class="custom-dropdown-btn" style="background: white; color: #333; border: 2px solid #333; padding: 10px 20px; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 1em; width: 100%; max-width: 300px; text-align: left;">
                ${options[0].label}
            </button>
            <div class="custom-dropdown-menu" style="display: none; background: white; border: 2px solid #333; border-top: none; border-radius: 0 0 8px 8px; position: absolute; top: 100%; left: 0; width: 100%; max-width: 300px; z-index: 1000; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                ${options.map(opt => `<div class="custom-dropdown-option" data-value="${opt.value}" style="padding: 12px 20px; color: #333; cursor: pointer; font-weight: 500; hover:background: #f5f5f5;">${opt.label}</div>`).join('')}
            </div>
        `;
        customDropdown.style.position = 'relative';
        customDropdown.style.display = 'inline-block';
        customDropdown.style.marginBottom = '15px';
        customDropdown.style.width = '100%';
        customDropdown.style.maxWidth = '300px';
        
        scaleSelect.parentNode.insertBefore(customDropdown, scaleSelect);
        scaleSelect.style.display = 'none';
        
        const btn = customDropdown.querySelector('.custom-dropdown-btn');
        const menu = customDropdown.querySelector('.custom-dropdown-menu');
        
        btn.addEventListener('click', () => {
            menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
        });
        
        customDropdown.querySelectorAll('.custom-dropdown-option').forEach(opt => {
            opt.addEventListener('click', () => {
                const value = opt.dataset.value;
                btn.textContent = opt.textContent;
                scaleSelect.value = value;
                menu.style.display = 'none';
            });
            opt.addEventListener('mouseover', () => {
                opt.style.backgroundColor = '#f5f5f5';
            });
            opt.addEventListener('mouseout', () => {
                opt.style.backgroundColor = 'white';
            });
        });
        
        // Close menu on outside click
        document.addEventListener('click', (e) => {
            if (!customDropdown.contains(e.target)) {
                menu.style.display = 'none';
            }
        });
    }
    
    const scales = {
        'major': { notes: ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'], info: 'The major scale is foundational in Western music, known for its bright, happy sound.' },
        'minor': { notes: ['A3', 'B3', 'C4', 'D4', 'E4', 'F4', 'G4', 'A4'], info: 'The natural minor scale has a darker, more melancholic sound than major.' },
        'pentatonic': { notes: ['C4', 'D4', 'E4', 'G4', 'A4', 'C5'], info: 'Used globally in many cultures including Chinese, Japanese, and West African music.' },
        'raga': { notes: ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'], info: 'Indian ragas have specific rules for melody and are associated with times of day and emotions.' },
        'maqam': { notes: ['C4', 'Db4', 'E4', 'F4', 'G4', 'Ab4', 'B4', 'C5'], info: 'Middle Eastern maqamat use quarter tones and have unique emotional qualities.' }
    };
    
    playScaleBtn.addEventListener('click', async () => {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            // Create master gain if not exists
            if (!window.__MASTER_GAIN) {
                try {
                    const masterGain = audioContext.createGain();
                    masterGain.gain.value = 1.0;
                    masterGain.connect(audioContext.destination);
                    window.__MASTER_GAIN = masterGain;
                } catch (e) {
                    console.warn('Master gain creation failed:', e);
                }
            }
        }
        
        // Resume audio context if suspended (Safari requirement)
        if (audioContext.state === 'suspended') {
            try {
                await audioContext.resume();
                console.log('AudioContext resumed for Safari');
            } catch (e) {
                console.warn('AudioContext resume failed:', e);
                return; // Exit if resume fails
            }
        }
        
        console.log('Playing scale, audioContext state:', audioContext.state);
        
        const selectedScale = scaleSelect.value;
        const scale = scales[selectedScale];
        
        const currentTime = audioContext.currentTime;
        
        scale.notes.forEach((note, i) => {
            playNote(noteToFrequency(note), currentTime + i * 0.5, 0.3);
        });
        
        scaleInfo.innerHTML = `<p style="margin-top: 15px; padding: 15px; background: #f0f0f0; border-radius: 8px;">${scale.info}</p>`;
    });
}

// Recorder
function initializeRecorder() {
    const recordBtn = document.getElementById('record-btn');
    const stopRecordBtn = document.getElementById('stop-record-btn');
    const recordingStatus = document.getElementById('recording-status');
    const downloadBtn = document.getElementById('download-recording');
    let mediaStream = null;
    let recordingMimeType = 'audio/webm'; // Default, will be updated
    
    alert('🔍 initializeRecorder called:\nrecord-btn: ' + (recordBtn ? 'FOUND' : 'NOT FOUND') + '\nstop-record-btn: ' + (stopRecordBtn ? 'FOUND' : 'NOT FOUND') + '\nrecording-status: ' + (recordingStatus ? 'FOUND' : 'NOT FOUND'));
    
    if (!recordBtn || !stopRecordBtn) {
        alert('❌ ERROR: Missing button elements! Cannot initialize recorder');
        return;
    }
    
    recordBtn.addEventListener('click', async () => {
        alert('🎤 Record button clicked!');
        try {
            if (!audioContext) {
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
            
            alert('📡 Requesting microphone...');
            mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            alert('✅ Microphone access granted! Starting recording...');
            
            // Safari works best with WAV format for MediaRecorder output
            let mimeType = 'audio/wav';
            const options = {};
            
            // Try to use supported format
            if (MediaRecorder.isTypeSupported('audio/mp4')) {
                mimeType = 'audio/mp4';
                options.mimeType = mimeType;
            } else if (MediaRecorder.isTypeSupported('audio/webm')) {
                mimeType = 'audio/webm;codecs=opus';
                options.mimeType = mimeType;
            } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
                mimeType = 'audio/ogg';
                options.mimeType = mimeType;
            }
            // If none of above, don't specify mimeType and use browser default
            
            recordingMimeType = mimeType;
            alert('🎙️ Format: ' + mimeType);
            mediaRecorder = new MediaRecorder(mediaStream, Object.keys(options).length > 0 ? options : undefined);
            audioChunks = [];
            
            mediaRecorder.addEventListener('dataavailable', event => {
                audioChunks.push(event.data);
            });
            
            mediaRecorder.addEventListener('stop', () => {
                alert('⏹️ Stop event triggered');
                
                const audioBlob = new Blob(audioChunks, { type: recordingMimeType });
                alert('📦 Audio blob created:\nSize: ' + audioBlob.size + ' bytes\nType: ' + audioBlob.type + '\nChunks: ' + audioChunks.length);
                
                if (audioBlob.size === 0) {
                    alert('❌ ERROR: Audio blob is EMPTY! No data was recorded.');
                    return;
                }
                
                const audioUrl = URL.createObjectURL(audioBlob);
                alert('🔗 Object URL created: ' + (audioUrl ? 'SUCCESS' : 'FAILED'));
                
                // Get elements
                const audio = document.getElementById('audio-playback');
                const recordedAudioDiv = document.getElementById('recorded-audio');
                const analyzeBtn = document.getElementById('analyze-recording');
                
                alert('📍 Looking for elements:\naudio: ' + (audio ? 'FOUND' : 'NOT FOUND') + '\nrecorded-audio div: ' + (recordedAudioDiv ? 'FOUND' : 'NOT FOUND'));
                
                // Verify elements exist
                if (!audio) {
                    alert('❌ ERROR: Audio player (audio-playback) not found!');
                    return;
                }
                if (!recordedAudioDiv) {
                    alert('❌ ERROR: Recording div (recorded-audio) not found!');
                    return;
                }
                
                // Set audio source and show player
                audio.src = audioUrl;
                audio.load();
                
                // Force display the recorded audio section
                recordedAudioDiv.style.display = 'block';
                recordedAudioDiv.style.visibility = 'visible';
                recordedAudioDiv.style.opacity = '1';
                
                alert('✅ Audio player visible! Size: ' + (audioBlob.size / 1024).toFixed(1) + ' KB');
                
                // Stop media stream tracks
                if (mediaStream) {
                    mediaStream.getTracks().forEach(track => track.stop());
                }
                
                // Enable analysis button
                if (analyzeBtn) {
                    analyzeBtn.onclick = () => {
                        console.log('Analyze button clicked, blob size:', audioBlob.size);
                        analyzeRecording(audioBlob);
                    };
                    console.log('Analyze button enabled');
                } else {
                    console.error('ERROR: analyze-recording button not found!');
                }
                
                // Enable download
                if (downloadBtn) {
                    downloadBtn.onclick = () => {
                        const a = document.createElement('a');
                        a.href = audioUrl;
                        // Determine file extension based on mime type
                        let ext = 'webm';
                        if (recordingMimeType.includes('mp4') || recordingMimeType.includes('aac')) ext = 'mp4';
                        else if (recordingMimeType.includes('wav')) ext = 'wav';
                        else if (recordingMimeType.includes('ogg')) ext = 'ogg';
                        a.download = `recording-${Date.now()}.${ext}`;
                        a.click();
                        console.log('Download initiated');
                    };
                    console.log('Download button enabled');
                }
                
                progressTracker?.addAchievement('recorded_audio');
            });
            
            mediaRecorder.start();
            recordBtn.disabled = true;
            stopRecordBtn.disabled = false;
            recordingStatus.textContent = '🔴 Recording...';
        } catch (error) {
            console.error('Recording error:', error);
            recordingStatus.innerHTML = `
                <div style="color: #f44336; margin-top: 10px;">
                    ❌ Recording failed: ${error.message}<br>
                    <small>Please allow microphone access to record.</small>
                </div>
            `;
        }
    });
    
    stopRecordBtn.addEventListener('click', () => {
        alert('🔴 STOP BUTTON CLICKED - mediaRecorder state: ' + (mediaRecorder ? mediaRecorder.state : 'NO RECORDER'));
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            alert('🔴 CALLING mediaRecorder.stop()...');
            mediaRecorder.stop();
            alert('🔴 stop() called, state is now: ' + mediaRecorder.state);
        } else {
            alert('🔴 ERROR: Cannot stop - mediaRecorder is null or state is: ' + (mediaRecorder ? mediaRecorder.state : 'NO RECORDER'));
        }
        recordBtn.disabled = false;
        stopRecordBtn.disabled = true;
        recordingStatus.textContent = '✅ Recording complete!';
    });
}

async function analyzeRecording(audioBlob) {
    const analysisDiv = document.getElementById('recording-analysis');
    
    if (!analysisDiv) {
        alert('ERROR: recording-analysis element not found!');
        return;
    }
    
    analysisDiv.innerHTML = '<p style="padding: 20px; background: #e3f2fd; border-radius: 8px; font-size: 1.1em;">🔄 Analyzing your recording...</p>';
    
    try {
        const arrayBuffer = await audioBlob.arrayBuffer();
        let audioBuffer;
        
        try {
            audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
        } catch (decodeError) {
            throw new Error(`Failed to decode audio: ${decodeError.message}`);
        }
        
        const channelData = audioBuffer.getChannelData(0);
        
        // Comprehensive analysis
        if (!audioAnalyzer) {
            throw new Error('AudioAnalyzer not initialized');
        }
        
        // Defensive checks for method availability
        let rhythmAnalysis = {};
        let pitchAnalysis = {};
        let timbreAnalysis = {};
        
        try {
            if (typeof audioAnalyzer.analyzeRhythm === 'function') {
                rhythmAnalysis = audioAnalyzer.analyzeRhythm(channelData);
            } else {
                console.warn('analyzeRhythm not available, using defaults');
                rhythmAnalysis = { tempo: 0, peakCount: 0, regularity: 0, intervals: [] };
            }
        } catch (e) {
            console.error('Error analyzing rhythm:', e);
            rhythmAnalysis = { tempo: 0, peakCount: 0, regularity: 0, intervals: [] };
        }
        
        try {
            if (typeof audioAnalyzer.analyzePitch === 'function') {
                pitchAnalysis = audioAnalyzer.analyzePitch(channelData, audioBuffer.sampleRate);
            } else {
                console.warn('analyzePitch not available, using defaults');
                pitchAnalysis = { dominantFrequency: 0, frequency: 0, note: 'None', clarity: 0, confidence: 0 };
            }
        } catch (e) {
            console.error('Error analyzing pitch:', e);
            pitchAnalysis = { dominantFrequency: 0, frequency: 0, note: 'None', clarity: 0, confidence: 0 };
        }
        
        try {
            if (typeof audioAnalyzer.analyzeTimbre === 'function') {
                timbreAnalysis = audioAnalyzer.analyzeTimbre(channelData);
            } else {
                console.warn('analyzeTimbre not available, using defaults');
                timbreAnalysis = { spectralCentroid: 0, brightness: 0, brightnessLabel: 'Unknown', energy: 0 };
            }
        } catch (e) {
            console.error('Error analyzing timbre:', e);
            timbreAnalysis = { spectralCentroid: 0, brightness: 0, brightnessLabel: 'Unknown', energy: 0 };
        }
        
        // Find similar cultures based on characteristics
        const allCultures = getAllCultures();
        let matches = [];
        
        allCultures.forEach(culture => {
            let score = 0;
            const tempoRange = culture.characteristics.tempo.split('-').map(t => parseInt(t));
            const avgTempo = (tempoRange[0] + tempoRange[1]) / 2;
            
            const tempoDiff = Math.abs(rhythmAnalysis.tempo - avgTempo);
            if (tempoDiff < 20) score += 3;
            else if (tempoDiff < 40) score += 2;
            else if (tempoDiff < 60) score += 1;
            
            if (rhythmAnalysis.regularity > 0.7 && culture.characteristics.rhythm.includes('regular')) score += 2;
            if (rhythmAnalysis.regularity < 0.5 && culture.characteristics.rhythm.includes('complex')) score += 2;
            
            if (score > 0) {
                matches.push({ culture, score });
            }
        });
        
        matches.sort((a, b) => b.score - a.score);
        const topMatches = matches.slice(0, 3);
        
        let comparisonHTML = '';
        if (topMatches.length > 0) {
            comparisonHTML = `
                <div style="margin-top: 20px; padding: 15px; background: #e8f5e9; border-radius: 8px; border-left: 4px solid #4caf50;">
                    <h4 style="margin-top: 0; color: #2e7d32;">🌍 Similar Musical Cultures</h4>
                    <p style="margin: 0 0 15px; font-size: 0.9em;">
                        Based on your recording's tempo, rhythm, and characteristics, here are similar cultures:
                    </p>
                    ${topMatches.map((match, i) => `
                        <div style="margin: 10px 0; padding: 12px; background: white; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                            <strong style="font-size: 1.1em;">${i + 1}. ${match.culture.emoji} ${match.culture.name}</strong>
                            <p style="margin: 5px 0 0; font-size: 0.85em; color: #555;">
                                <strong>Match Score:</strong> ${match.score}/7 | 
                                <strong>Typical Tempo:</strong> ${match.culture.characteristics.tempo} BPM
                            </p>
                            <p style="margin: 5px 0 0; font-size: 0.85em; color: #666;">
                                <strong>Rhythm Style:</strong> ${match.culture.characteristics.rhythm}
                            </p>
                            <p style="margin: 5px 0 0; font-size: 0.85em; color: #666;">
                                <strong>Common Scales:</strong> ${match.culture.characteristics.scales}
                            </p>
                        </div>
                    `).join('')}
                    <button class="btn-secondary" style="margin-top: 10px;" onclick="document.querySelector('[data-tab=\\'explore\\']').click(); setTimeout(() => document.getElementById('explore-tab').scrollIntoView({behavior: 'smooth'}), 100);">
                        🔍 Explore These Cultures
                    </button>
                </div>
            `;
        } else {
            comparisonHTML = `
                <div style="margin-top: 20px; padding: 15px; background: #fff3e0; border-radius: 8px; border-left: 4px solid #ff9800;">
                    <h4 style="margin-top: 0;">🌍 Cultural Comparison</h4>
                    <p style="margin: 0; font-size: 0.9em;">
                        No strong matches found with the available cultures. Your recording might have unique characteristics!
                        Try recording with clearer rhythm or longer duration for better matching.
                    </p>
                </div>
            `;
        }
        
        console.log('Rendering analysis results...');
        analysisDiv.innerHTML = `
            <div style="margin-top: 20px; padding: 20px; background: #f5f5f5; border-radius: 10px;">
                <h3 style="margin-top: 0; color: #667eea;">📊 Your Recording Analysis</h3>
                
                <div style="display: grid; gap: 15px; margin: 20px 0;">
                    <div style="padding: 15px; background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <h4 style="margin: 0 0 10px; color: #ff9800;">🥁 Rhythm & Tempo</h4>
                        <p style="margin: 5px 0;"><strong>Tempo:</strong> ${rhythmAnalysis.tempo} BPM</p>
                        <p style="margin: 5px 0;"><strong>Regularity:</strong> ${(rhythmAnalysis.regularity * 100).toFixed(1)}%</p>
                        <p style="margin: 5px 0;"><strong>Detected Beats:</strong> ${rhythmAnalysis.peakCount}</p>
                        <p style="margin: 8px 0 0; padding: 8px; background: #fff3e0; border-radius: 4px; font-size: 0.85em;">
                            ${rhythmAnalysis.regularity > 0.7 ? '✓ Steady, consistent rhythm' : rhythmAnalysis.regularity > 0.5 ? '~ Moderately regular pattern' : '≈ Variable, free-flowing rhythm'}
                        </p>
                    </div>
                    
                    <div style="padding: 15px; background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <h4 style="margin: 0 0 10px; color: #9c27b0;">🎵 Pitch & Melody</h4>
                        <p style="margin: 5px 0;"><strong>Dominant Frequency:</strong> ${pitchAnalysis.dominantFrequency.toFixed(1)} Hz</p>
                        <p style="margin: 5px 0;"><strong>Pitch Stability:</strong> ${(pitchAnalysis.clarity * 100).toFixed(1)}%</p>
                        <p style="margin: 8px 0 0; padding: 8px; background: #f3e5f5; border-radius: 4px; font-size: 0.85em;">
                            ${pitchAnalysis.clarity > 0.7 ? '✓ Clear, stable pitch' : pitchAnalysis.clarity > 0.4 ? '~ Moderate pitch variation' : '≈ Highly variable pitch'}
                        </p>
                    </div>
                    
                    <div style="padding: 15px; background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <h4 style="margin: 0 0 10px; color: #4caf50;">🎨 Timbre & Texture</h4>
                        <p style="margin: 5px 0;"><strong>Brightness:</strong> ${(timbreAnalysis.brightness * 100).toFixed(1)}%</p>
                        <p style="margin: 5px 0;"><strong>Harmonic Complexity:</strong> ${timbreAnalysis.spectralCentroid.toFixed(0)} Hz</p>
                        <p style="margin: 8px 0 0; padding: 8px; background: #e8f5e9; border-radius: 4px; font-size: 0.85em;">
                            ${timbreAnalysis.brightness > 0.6 ? '✓ Bright, shimmering tone' : timbreAnalysis.brightness > 0.4 ? '~ Balanced timbre' : '≈ Warm, mellow tone'}
                        </p>
                    </div>
                </div>
                
                ${comparisonHTML}
                
                <div style="margin-top: 20px; padding: 12px; background: #e3f2fd; border-radius: 8px; border-left: 4px solid #2196f3;">
                    <p style="margin: 0; font-size: 0.9em;">
                        <strong>💡 Tip:</strong> Try recording yourself playing or singing music from different cultures to compare and explore how musical characteristics vary across traditions!
                    </p>
                </div>
            </div>
        `;
        
        progressTracker?.addAchievement('analyzed_recording');
    } catch (error) {
        analysisDiv.innerHTML = `
            <div style="padding: 15px; background: #ffebee; border-radius: 8px; color: #c62828;">
                <strong>❌ Analysis Failed:</strong> ${error.message}
                <p style="margin: 10px 0 0; font-size: 0.9em;">
                    Try recording for at least 3-5 seconds with clear audio.
                </p>
            </div>
        `;
        alert('Analysis error: ' + error.message);
    }
}

// Live Pitch Detection
function initializeLivePitch() {
    const startBtn = document.getElementById('start-live-pitch');
    const stopBtn = document.getElementById('stop-live-pitch');
    const canvas = document.getElementById('pitch-contour');
    const display = document.getElementById('pitch-display');
    
    if (!startBtn || !canvas) return;
    
    visualizer = new Visualizer3D(canvas);
    let pitchHistory = [];
    let animationId = null;
    
    function detectPitchLoop() {
        if (!pitchDetector || !pitchDetector.isActive) return;
        
        const pitch = pitchDetector.getPitch();
        const volume = pitchDetector.getVolume();
        
        if (pitch > 0 && pitch < 2000) {
            pitchHistory.push(pitch);
            if (pitchHistory.length > 100) pitchHistory.shift();
            
            // Display pitch info
            if (display) {
                const note = frequencyToNote(pitch);
                display.innerHTML = `
                    <div style="font-size: 2em; font-weight: bold; color: #00ff00;">${note}</div>
                    <div>Frequency: ${pitch.toFixed(2)} Hz</div>
                    <div>Volume: ${(volume * 100).toFixed(1)}%</div>
                `;
            }
            
            // Draw pitch contour
            visualizer.drawPitchContour(pitchHistory);
        }
        
        animationId = requestAnimationFrame(detectPitchLoop);
    }
    
    function frequencyToNote(freq) {
        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const a4 = 440;
        const halfSteps = Math.round(12 * Math.log2(freq / a4));
        const octave = Math.floor((halfSteps + 57) / 12);
        const noteIndex = (halfSteps + 57) % 12;
        return noteNames[noteIndex] + octave;
    }
    
    startBtn.addEventListener('click', async () => {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        
        pitchDetector = new RealTimePitchDetector(audioContext);
        const success = await pitchDetector.start();
        
        if (success) {
            startBtn.disabled = true;
            stopBtn.disabled = false;
            pitchHistory = [];
            detectPitchLoop();
            progressTracker.addAchievement('used_live_pitch');
        } else {
            alert('Microphone access denied. Please allow microphone access to use this feature.');
        }
    });
    
    stopBtn?.addEventListener('click', () => {
        if (pitchDetector) {
            pitchDetector.stop();
            pitchDetector = null;
        }
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }
        startBtn.disabled = false;
        stopBtn.disabled = true;
        pitchHistory = [];
        if (display) display.innerHTML = '<div style="opacity: 0.6;">Click Start to begin pitch detection</div>';
    });
}

// Composer & Looper
function initializeComposer() {
    // Initialize culture select dropdowns for scale mixer
    const basicCultures = getAllCultures();
    const culture1Select = document.getElementById('culture1-select');
    const culture2Select = document.getElementById('culture2-select');
    
    basicCultures.forEach(culture => {
        const option1 = document.createElement('option');
        option1.value = culture.id;
        option1.textContent = culture.name;
        culture1Select?.appendChild(option1);
        
        const option2 = document.createElement('option');
        option2.value = culture.id;
        option2.textContent = culture.name;
        culture2Select?.appendChild(option2);
    });
    
    // Mix scales button
    document.getElementById('mix-scales')?.addEventListener('click', () => {
        const culture1Id = culture1Select?.value;
        const culture2Id = culture2Select?.value;
        
        if (!culture1Id || !culture2Id) {
            alert('Please select two cultures');
            return;
        }
        
        const culture1 = basicCultures.find(c => c.id === culture1Id);
        const culture2 = basicCultures.find(c => c.id === culture2Id);
        
        if (!culture1 || !culture2) return;
        
        // Get scales from culture characteristics
        const scales1 = culture1.characteristics.scales.split(',').map(s => s.trim());
        const scales2 = culture2.characteristics.scales.split(',').map(s => s.trim());
        
        const displayDiv = document.getElementById('mixed-scale-display');
        displayDiv.innerHTML = `
            <div style="margin-top: 20px; padding: 20px; background: #f0f4ff; border-radius: 8px;">
                <h4>${culture1.emoji} ${culture1.name} Scales:</h4>
                <p>${scales1.join(', ')}</p>
                
                <h4>${culture2.emoji} ${culture2.name} Scales:</h4>
                <p>${scales2.join(', ')}</p>
                
                <h4>✨ Mixed Characteristics:</h4>
                <p>
                    <strong>Blended Rhythm:</strong> ${culture1.characteristics.rhythm} + ${culture2.characteristics.rhythm}<br>
                    <strong>Combined Instruments:</strong> ${culture1.characteristics.instruments} + ${culture2.characteristics.instruments}<br>
                    <strong>Tempos:</strong> ${culture1.characteristics.tempo} / ${culture2.characteristics.tempo}
                </p>
                
                <button class="btn-primary" onclick="playMixedScale('${culture1Id}', '${culture2Id}')">🔊 Play Mixed Scale</button>
                <p style="margin-top: 15px; font-size: 0.9em; color: #666;">
                    This creates an interesting fusion of musical traditions from ${culture1.name} and ${culture2.name}!
                </p>
            </div>
        `;
    });
    
    // Composition canvas
    const canvas = document.getElementById('composition-canvas');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        let notes = [];
        
        // Set canvas display size
        canvas.style.border = '2px solid #667eea';
        canvas.style.cursor = 'crosshair';
        canvas.style.backgroundColor = '#34495e';
        
        function drawGrid() {
            // Clear canvas with background
            ctx.fillStyle = '#34495e';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            // Draw grid lines
            ctx.strokeStyle = '#555';
            ctx.lineWidth = 1;
            for (let i = 0; i <= canvas.width; i += 50) {
                ctx.beginPath();
                ctx.moveTo(i, 0);
                ctx.lineTo(i, canvas.height);
                ctx.stroke();
            }
            for (let i = 0; i <= canvas.height; i += 50) {
                ctx.beginPath();
                ctx.moveTo(0, i);
                ctx.lineTo(canvas.width, i);
                ctx.stroke();
            }
            
            // Draw center line
            ctx.strokeStyle = '#667eea';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(0, canvas.height / 2);
            ctx.lineTo(canvas.width, canvas.height / 2);
            ctx.stroke();
            
            // Draw notes
            notes.forEach(note => {
                ctx.fillStyle = '#00ff00';
                ctx.beginPath();
                ctx.arc(note.x, note.y, 8, 0, Math.PI * 2);
                ctx.fill();
            });
            
            // Draw help text
            ctx.fillStyle = '#999';
            ctx.font = '12px Arial';
            ctx.fillText('Click to add notes', 10, 20);
        }
        
        // Status label under canvas
        const statusEl = document.getElementById('composition-status') || (() => {
            const el = document.createElement('div');
            el.id = 'composition-status';
            el.style.margin = '8px 0 0';
            el.style.fontSize = '0.9em';
            el.style.opacity = '0.85';
            el.style.color = '#f1f5f9';
            el.style.textAlign = 'center';
            el.setAttribute('role', 'status');
            el.setAttribute('aria-live', 'polite');
            const parent = canvas.parentElement;
            if (parent) {
                parent.insertBefore(el, canvas.nextSibling);
            }
            return el;
        })();
        const setStatus = (text) => { if (statusEl) statusEl.textContent = text; };

        // Initial draw
        drawGrid();
        setStatus('Click the canvas to add notes.');
        
        canvas.addEventListener('click', (e) => {
            const rect = canvas.getBoundingClientRect();
            notes.push({ x: e.clientX - rect.left, y: e.clientY - rect.top });
            drawGrid();
            setStatus(`Notes: ${notes.length}`);
        });
        
        const playBtn = document.getElementById('play-composition');
        const stopBtn = document.getElementById('stop-composition');
        let reenableTimer = null;
        playBtn?.addEventListener('click', async () => {
            try {
                if (!composer) {
                    setStatus('Composer not initialized.');
                    return;
                }
                if (!notes || notes.length === 0) {
                    setStatus('No notes yet — click the canvas to add notes.');
                    return;
                }

                // Ensure audio context is active and ready
                if (!audioContext) {
                    setStatus('Audio context not available.');
                    return;
                }
                
                if (audioContext.state === 'suspended') {
                    // console.log('Resuming AudioContext...');
                    try { 
                        await audioContext.resume(); 
                        // console.log('AudioContext resumed, state:', audioContext.state);
                    } catch (resumeErr) {
                        console.error('Resume failed:', resumeErr);
                        setStatus('Failed to resume audio.');
                        return;
                    }
                }
                
                // console.log('Building sequence with', notes.length, 'notes');
                composer.clearSequence();
                notes.forEach(note => {
                    const frequency = 200 + (1 - note.y / canvas.height) * 600;
                    const time = (note.x / canvas.width) * 4;
                    composer.addNote(frequency, 0.3, time);
                });
                
                // console.log('Composer sequence ready, playing...');
                // UI feedback during playback
                setStatus(`Playing… ${notes.length} note${notes.length === 1 ? '' : 's'}`);
                if (playBtn) playBtn.disabled = true;

                // Estimate duration to re-enable
                const totalDuration = Math.max(0, ...notes.map(n => (n.x / canvas.width) * 4 + 0.3));
                await composer.playSequence();
                // console.log('Play sequence complete');
                reenableTimer = setTimeout(() => {
                    setStatus(`Done. Notes: ${notes.length}`);
                    if (playBtn) playBtn.disabled = false;
                }, Math.ceil(totalDuration * 1000) + 50);
                progressTracker.addAchievement('composed_music');
            } catch (e) {
                console.error('Play composition failed:', e);
                setStatus('Playback failed — check console for details.');
                if (playBtn) playBtn.disabled = false;
            }
        });
        
        stopBtn?.addEventListener('click', () => {
            try {
                if (!composer) return;
                composer.stop();
                if (reenableTimer) {
                    clearTimeout(reenableTimer);
                    reenableTimer = null;
                }
                if (playBtn) playBtn.disabled = false;
                setStatus('Stopped.');
            } catch (e) {
                console.warn('Stop composition failed:', e);
            }
        });
        
        document.getElementById('clear-composition')?.addEventListener('click', () => {
            notes = [];
            drawGrid();
            setStatus('Cleared. Click the canvas to add notes.');
        });
    }
    
    // Loop controls
    document.getElementById('record-loop')?.addEventListener('click', () => {
        alert('Loop recording feature coming soon!');
    });
    
    document.getElementById('stop-loop')?.addEventListener('click', () => {
        alert('Loop stopped');
    });
    
    document.getElementById('play-loops')?.addEventListener('click', () => {
        alert('Play loops feature coming soon!');
    });
    
    document.getElementById('clear-loops')?.addEventListener('click', () => {
        document.getElementById('loop-display').innerHTML = '<p>Loops cleared</p>';
    });
}

// Play mixed scale demonstration - GLOBAL FUNCTION
window.playMixedScale = function(culture1Id, culture2Id) {
    const basicCultures = getAllCultures();
    const culture1 = basicCultures.find(c => c.id === culture1Id);
    const culture2 = basicCultures.find(c => c.id === culture2Id);
    
    if (!culture1 || !culture2 || !audioContext) return;
    
    // Create a blended scale by combining both culture scales
    const scaleNotes = ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'];
    const currentTime = audioContext.currentTime;
    
    // Play culture 1 scale
    scaleNotes.forEach((note, i) => {
        playNote(noteToFrequency(note), currentTime + i * 0.4, 0.3);
    });
    
    // Play culture 2 scale offset
    scaleNotes.forEach((note, i) => {
        playNote(noteToFrequency(note), currentTime + (i + 0.2) * 0.4, 0.3);
    });
};

// Progress Tracker
// Global progress interval tracker
let progressInterval = null;

function initializeProgress() {
    updateProgressDisplay();
    displayGlossary();
    
    // Clear any existing interval
    if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
    }
    
    // Only update progress periodically while a session is active and the Progress tab is visible
    if (dashboardSession) {
        progressInterval = setInterval(() => {
            if (!dashboardSession) {
                clearInterval(progressInterval);
                progressInterval = null;
                return;
            }
            const progressTab = document.getElementById('progress-tab');
            if (progressTab?.classList.contains('active')) {
                updateProgressDisplay();
            }
        }, 5000);
    }
    
    function updateProgressDisplay() {
        const levelEl = document.getElementById('user-level');
        const xpEl = document.getElementById('current-xp');
        const nextXpEl = document.getElementById('next-level-xp');
        const xpFillEl = document.getElementById('xp-fill');
        
        if (levelEl) levelEl.textContent = progressTracker.level;
        if (xpEl) xpEl.textContent = progressTracker.xp;
        if (nextXpEl) nextXpEl.textContent = progressTracker.level * 100;
        if (xpFillEl) {
            const xpPercent = (progressTracker.xp / (progressTracker.level * 100)) * 100;
            xpFillEl.style.width = xpPercent + '%';
        }
        
        // Badges
        const badgesGrid = document.getElementById('badges-grid');
        if (badgesGrid) {
            badgesGrid.innerHTML = '';
            progressTracker.getBadges().forEach(badge => {
                const div = document.createElement('div');
                div.className = 'badge-item';
                div.innerHTML = `<div class="badge-icon">${badge.icon}</div><div>${badge.name}</div>`;
                badgesGrid.appendChild(div);
            });
        }
    }
}

function displayGlossary() {
    const glossaryContent = document.getElementById('glossary-content');
    if (!glossaryContent) return;
    
    Object.entries(musicalGlossary).forEach(([term, definition]) => {
        const div = document.createElement('div');
        div.className = 'glossary-item';
        div.innerHTML = `
            <div class="glossary-term">${term}</div>
            <div class="glossary-definition">${definition}</div>
        `;
        glossaryContent.appendChild(div);
    });
}

// Dark Mode
function initializeDarkMode() {
    const darkModeBtn = document.getElementById('dark-mode-toggle');
    if (!darkModeBtn) return;
    
    const savedMode = localStorage.getItem('darkMode');
    if (savedMode === 'true') {
        document.body.classList.add('dark-mode');
        darkModeBtn.textContent = '☀️';
        isDarkMode = true;
    }
    
    darkModeBtn.addEventListener('click', () => {
        isDarkMode = !isDarkMode;
        document.body.classList.toggle('dark-mode');
        darkModeBtn.textContent = isDarkMode ? '☀️' : '🌙';
        localStorage.setItem('darkMode', isDarkMode);
    });
}

// Display all 16 expanded cultures
function displayExpandedCultures() {
    const expandedCultures = getAllExpandedCultures();
    // console.log(`Loaded ${expandedCultures.length} expanded cultures`);
    
    // These are already displayed in culture grid by initializeCultureExplorer
    // Add audio sample and video functionality
    expandedCultures.forEach(culture => {
        if (culture.audioSample) {
            // console.log(`Audio sample available for ${culture.name}: ${culture.audioSample}`);
        }
        if (culture.videoTutorial) {
            // console.log(`Video tutorial available for ${culture.name}: ${culture.videoTutorial}`);
        }
    });
}

// Extended Quiz with 20 questions
function initializeExtendedQuiz() {
    const extendedQuizBtn = document.getElementById('start-extended-quiz');
    if (!extendedQuizBtn) return;
    
    extendedQuizBtn.addEventListener('click', () => {
        trackDashboardActivity('quiz');
        const questions = getRandomQuestions(10);
        let currentQ = 0;
        let score = 0;
        
        const container = document.createElement('div');
        container.className = 'extended-quiz-container';
        container.style.cssText = 'padding: 20px; background: white; border-radius: 10px; margin: 20px 0;';
        
        function showQuestion() {
            if (currentQ >= questions.length) {
                container.innerHTML = `
                    <h3>Quiz Complete!</h3>
                    <p>Score: ${score}/${questions.length} (${((score/questions.length)*100).toFixed(0)}%)</p>
                    <button class="btn-primary" onclick="location.reload()">Try Again</button>
                `;
                progressTracker.addXP(score * 10);
                if (score === questions.length) {
                    progressTracker.addAchievement('perfect_quiz');
                }
                return;
            }
            
            const q = questions[currentQ];
            container.innerHTML = `
                <h4>Question ${currentQ + 1}/${questions.length}</h4>
                <p style="font-size: 1.1em; margin: 20px 0;">${q.question}</p>
                <div class="difficulty-badge" style="display: inline-block; padding: 5px 10px; background: ${q.difficulty === 'easy' ? '#4caf50' : q.difficulty === 'medium' ? '#ff9800' : '#f44336'}; color: white; border-radius: 5px; margin-bottom: 15px;">
                    ${q.difficulty.toUpperCase()}
                </div>
                ${q.options.map((opt, i) => `
                    <button class="btn-primary quiz-option" data-index="${i}" style="display: block; width: 100%; margin: 10px 0; padding: 15px; text-align: left;">
                        ${opt}
                    </button>
                `).join('')}
            `;
            
            container.querySelectorAll('.quiz-option').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const answer = parseInt(e.target.dataset.index);
                    const correct = answer === q.correct;
                    
                    if (correct) {
                        score++;
                        e.target.style.background = '#4caf50';
                        e.target.innerHTML += ' ✓';
                    } else {
                        e.target.style.background = '#f44336';
                        e.target.innerHTML += ' ✗';
                        container.querySelectorAll('.quiz-option')[q.correct].style.background = '#4caf50';
                    }
                    
                    container.querySelectorAll('.quiz-option').forEach(b => b.disabled = true);
                    
                    setTimeout(() => {
                        currentQ++;
                        showQuestion();
                    }, 1500);
                });
            });
        }
        
        extendedQuizBtn.parentNode.appendChild(container);
        extendedQuizBtn.style.display = 'none';
        showQuestion();
    });
}

// Lesson Plans for Educators
function initializeLessonPlans() {
    const lessonsContainer = document.getElementById('lesson-plans-container');
    if (!lessonsContainer) return;
    
    lessonPlans.forEach(lesson => {
        const lessonCard = document.createElement('div');
        lessonCard.className = 'lesson-card';
        lessonCard.style.cssText = 'background: white; padding: 20px; margin: 15px 0; border-radius: 10px; border-left: 5px solid #667eea;';
        
        lessonCard.innerHTML = `
            <h3>${lesson.title}</h3>
            <p><strong>Grade Level:</strong> ${lesson.grade} | <strong>Duration:</strong> ${lesson.duration}</p>
            
            <h4>Learning Objectives:</h4>
            <ul>
                ${lesson.objectives.map(obj => `<li>${obj}</li>`).join('')}
            </ul>
            
            <h4>Activities:</h4>
            <ol>
                ${lesson.activities.map(act => `<li>${act}</li>`).join('')}
            </ol>
            
            <p><strong>Assessment:</strong> ${lesson.assessment}</p>
            <p><strong>Extensions:</strong> ${lesson.extensions}</p>
            
            <div style="margin-top: 15px; display: flex; gap: 10px; flex-wrap: wrap;">
                <button class="btn-primary download-lesson-pdf">📥 Download Lesson PDF</button>
                <button class="btn-secondary download-worksheet">📝 Download Student Worksheet</button>
            </div>
        `;
        
        const downloadBtn = lessonCard.querySelector('.download-lesson-pdf');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => downloadLessonPlan(lesson.title, lesson));
        }
        
        const worksheetBtn = lessonCard.querySelector('.download-worksheet');
        if (worksheetBtn) {
            worksheetBtn.addEventListener('click', () => downloadWorksheet(lesson.title, lesson));
        }
        
        lessonsContainer.appendChild(lessonCard);
    });
}

// Accessibility Features
let accessibilityListenersInitialized = false;

function initializeAccessibility() {
    if (accessibilityListenersInitialized) return; // Only setup once
    
    // Toggle accessibility menu - using event delegation
    document.addEventListener('click', (e) => {
        const menuToggle = document.getElementById('accessibility-menu-toggle');
        const menu = document.getElementById('accessibility-menu');
        if (!menuToggle || !menu) return;
        
        if (e.target === menuToggle || menuToggle.contains(e.target)) {
            menu.style.display = menu.style.display === 'none' ? 'grid' : 'none';
            e.stopPropagation();
        } else if (!menu.contains(e.target)) {
            menu.style.display = 'none';
        }
    });
    
    // Text-to-speech toggle
    document.addEventListener('click', (e) => {
        if (e.target?.id === 'tts-toggle') {
            const text = document.querySelector('.tab-content.active')?.innerText || 'Welcome to Computational Ethnomusicology App';
            accessibilityHelpers.textToSpeech(text);
        }
    });
    
    // Font size controls
    document.addEventListener('click', (e) => {
        if (e.target?.id === 'increase-text') {
            accessibilityHelpers.increaseTextSize();
        } else if (e.target?.id === 'decrease-text') {
            accessibilityHelpers.decreaseTextSize();
        }
    });
    
    // High contrast toggle
    let isHighContrast = false;
    document.addEventListener('click', (e) => {
        if (e.target?.id === 'high-contrast-toggle') {
            isHighContrast = !isHighContrast;
            accessibilityHelpers.highContrast(isHighContrast);
            e.target.innerHTML = isHighContrast ? '<span>◐</span> Normal' : '<span>◐</span> High Contrast';
        }
    });
    
    accessibilityListenersInitialized = true;
}
