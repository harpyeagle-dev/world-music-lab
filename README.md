# 🎵 Ethnomusicology Explorer

[![CI](https://github.com/harpyeagle-dev/world-music-lab/actions/workflows/ci.yml/badge.svg)](https://github.com/harpyeagle-dev/world-music-lab/actions/workflows/ci.yml)
[![Deploy](https://github.com/harpyeagle-dev/world-music-lab/actions/workflows/pages.yml/badge.svg)](https://github.com/harpyeagle-dev/world-music-lab/actions/workflows/pages.yml)

An interactive computational ethnomusicology application designed for all ages to explore, analyze, and learn about music from cultures around the world.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D14.0.0-brightgreen.svg)

## 🌍 Overview

**Ethnomusicology Explorer** is a comprehensive music education platform combining advanced audio analysis, AI-powered composition, real-time pitch detection, and interactive learning to make world music accessible and engaging for all ages. Using cutting-edge audio processing algorithms, the app can analyze musical patterns, identify cultural characteristics, and provide deep educational insights about music from 16+ global traditions.

### Key Features

#### 🌏 Cultural Exploration (18+ Cultures)
- West African, Indian Classical, Chinese Traditional, Middle Eastern, Latin American
- Aboriginal Australian, European Folk, Japanese Traditional, Mongolian Throat Singing
- Indonesian Gamelan, Flamenco, Andean, Bluegrass, Brazilian Samba
- Caribbean Steel Pan, Korean Traditional, Venezuelan Joropo, Caribbean Rhythms
- Each with detailed information, characteristic sounds, and video tutorials

#### 🔬 Advanced Audio Analysis
- **Pitch Detection**: Autocorrelation-based fundamental frequency detection
- **Rhythm Analysis**: Tempo (BPM), beat regularity, onset detection
- **Spectral Analysis**: Timbre, brightness, harmonic content
- **Cultural Matching**: AI-powered suggestions for cultural origins
- **Real-time Processing**: Live microphone pitch detection

#### 🎤 Live Performance Tools
- **Real-time Pitch Visualization**: See your singing/playing in real-time
- **Pitch Contour Display**: Beautiful animated pitch graphs
- **Pitch Matching Game**: Match target notes with your voice
- **Volume Meter**: Visual feedback of your performance

#### 🎼 Music Creation Suite
- **Composition Canvas**: Visual piano roll for creating melodies
- **Cultural Scale Mixer**: Blend scales from different traditions
- **AI Music Generator**: Automatic melody creation
- **Loop Station**: Record and layer musical loops
- **MIDI Export**: Download your compositions

#### 🎮 Interactive Learning Games
- **Rhythm Matching**: Recreate complex rhythmic patterns
- **Pitch Matching Challenge**: Train your ear with precision
- **Culture Quiz**: Test your knowledge with 100+ questions
- **Instrument Identification**: Guess instruments by timbre
- **Scale Explorer**: Play and learn different musical scales
- **Rhythm Dictation**: Listen and transcribe rhythms

#### 📊 Progress & Achievements
- **Level System**: Earn XP and level up through learning
- **Badges & Achievements**: Unlock rewards for milestones
- **High Scores**: Track your best performances
- **Progress Saving**: LocalStorage saves your journey
- **Musical Glossary**: Learn 20+ music theory terms

#### 🎨 Customization & Accessibility
- **Dark Mode**: Eye-friendly theme toggle
- **Responsive Design**: Works on desktop, tablet, and mobile
- **Keyboard Shortcuts**: Power user features
- **Accessible UI**: ARIA labels and focus management
- **Multiple Visualizations**: 3D spectrograms, pitch contours, rhythm circles

#### 💾 Export & Sharing
- **Download Recordings**: Save your audio files
- **Export Analysis Reports**: PDF/text format reports
- **MIDI Export**: Use compositions in other software
- **JSON Data Export**: Full analysis data export

## 🚀 Quick Start

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Modern web browser with Web Audio API support

### Installation

```bash
# Clone the repository
cd "Computational Ethnousicology App"

# Install dependencies
npm install

# Start development server
npm start
```

The application will open automatically in your default browser at `http://localhost:8080`.

### Building for Production

```bash
npm run build
```

The production-ready files will be generated in the `dist/` directory.

### Deploying on GitHub Pages

- Deployment is handled automatically by GitHub Actions.
- Ensure Pages is set to "GitHub Actions" in Settings → Pages.
- The workflow in [.github/workflows/pages.yml](.github/workflows/pages.yml) builds and deploys on `main` pushes or manual runs.
- After deployment, your site will be available at your repository’s Pages URL.

Manual deploy:

```bash
# From the Actions tab, run "Deploy to GitHub Pages"
```

## 🎯 How to Use

### 1. Explore Cultures Tab

- Browse through different musical cultures from around the world
- Click on any culture card to learn about its musical characteristics
- Listen to synthesized demonstrations of each culture's scale patterns
- Read fascinating facts about instruments and traditions

### 2. Analyze Music Tab

- Upload any audio file (MP3, WAV, etc.)
- View detailed analysis including:
  - **Pitch Analysis**: Frequency distribution and note identification
  - **Rhythm Analysis**: Tempo detection, beat regularity, and onset detection
  - **Spectral Features**: Timbre characteristics and brightness
  - **Cultural Matching**: AI-powered suggestions for cultural origins

### 3. Learn & Play Tab

- **Rhythm Matcher**: Practice creating rhythmic patterns
- **Culture Quiz**: Test your knowledge of world music
- **Scale Explorer**: Play and learn about different musical scales from various traditions

### 4. Record & Compare Tab

- Record yourself singing or playing an instrument
- Analyze your recording's musical characteristics
- Compare your music to different cultural traditions

## 🔧 Technical Details

### Architecture

The app is built using:

- **Frontend**: Vanilla JavaScript (ES6+), HTML5, CSS3
- **Audio Processing**: Tone.js for synthesis, Web Audio API for analysis
- **Visualizations**: Chart.js for data visualization
- **Build System**: Webpack with Babel for modern JavaScript

### Core Algorithms

#### Pitch Detection
Uses autocorrelation method to detect fundamental frequency:
- Analyzes audio buffer in real-time
- Identifies dominant pitches and converts to musical notes
- Maps frequencies to MIDI note numbers

#### Rhythm Analysis
Detects rhythmic patterns through:
- Onset detection (note start times)
- Inter-onset interval calculation
- Tempo estimation (BPM)
- Regularity scoring (pattern consistency)

#### Spectral Analysis
Extracts timbral features including:
- Spectral centroid (brightness)
- Spectral rolloff (harmonic distribution)
- Spectral flux (timbral change over time)

#### Cultural Matching
Machine learning-inspired algorithm that:
- Compares analyzed features to cultural databases
- Scores matches based on tempo, scale, rhythm, and timbre
- Provides confidence ratings for cultural origins

### File Structure

```
Computational Ethnousicology App/
├── src/
│   ├── index.js              # Main application entry point
│   ├── index.html            # HTML template
│   ├── styles.css            # Styling
│   ├── audioAnalyzer.js      # Audio analysis algorithms
│   └── culturesData.js       # Cultural database and matching
├── dist/                     # Production build (generated)
├── package.json              # Project dependencies
├── webpack.config.js         # Webpack configuration
└── README.md                 # This file
```

## 🎓 Educational Use

This application is perfect for:

- **Students**: Learn about music theory and world cultures
- **Educators**: Teaching tool for music and cultural studies
- **Musicians**: Understand different musical traditions
- **Researchers**: Quick analysis of musical patterns
- **Curious Minds**: Explore the diversity of human musical expression

## 🌟 Features in Detail

### Cultural Database

Includes detailed information about:
- West African polyrhythmic traditions
- Indian classical ragas and talas
- Chinese pentatonic systems
- Middle Eastern maqamat
- Latin American syncopation
- Aboriginal Australian didgeridoo traditions
- European folk music
- Japanese traditional ma (space/silence)

### Analysis Capabilities

- **Pitch**: Fundamental frequency, note names, scale identification
- **Rhythm**: BPM, beat positions, regularity metrics
- **Timbre**: Spectral centroid, brightness, harmonic content
- **Pattern**: Repetition detection, melodic contours

## 🤝 Contributing

Contributions are welcome! Areas for improvement:

- Additional cultural traditions
- More sophisticated analysis algorithms
- Enhanced visualizations
- Mobile optimization
- Accessibility features
- Audio sample library

## 📝 Future Enhancements

- [ ] Real-time microphone analysis
- [ ] Collaborative learning features
- [ ] Expanded cultural database (100+ cultures)
- [ ] Machine learning for better cultural matching
- [ ] Audio sample library with authentic recordings
- [ ] Social sharing capabilities
- [ ] Multi-language support
- [ ] Offline mode

## 🙏 Acknowledgments

This project draws on research in:
- Computational musicology
- Digital signal processing
- Ethnomusicology
- Music information retrieval

Special thanks to the communities preserving and sharing their musical traditions.

## 📄 License

MIT License - feel free to use this project for educational purposes.

## 🐛 Troubleshooting

### Audio won't play
- Ensure your browser supports Web Audio API (Chrome, Firefox, Safari, Edge)
- Check browser permissions for audio playback
- Try clicking anywhere on the page first (browsers require user interaction)

### Recording doesn't work
- Grant microphone permissions when prompted
- Check browser console for errors
- Ensure you're using HTTPS or localhost

### Analysis seems inaccurate
- Ensure audio files are clear and not heavily compressed
- Better results with longer samples (30+ seconds)
- Monaural (single channel) audio works best

## 📧 Contact & Creator

**Created by Rohan R. Sagar** - A passionate developer dedicated to making world music accessible through technology.

For questions, suggestions, or feedback:
- 📧 Email: rohan@ethnomusicologyapp.com
- 💼 GitHub: Open an issue on the repository
- 🌐 Website: [Digital Heritage GY](https://www.digitalheritagegy.com)

---

**Built with ❤️ by Rohan R. Sagar for music education and cultural appreciation**

*"Music is the universal language that connects all cultures."*
