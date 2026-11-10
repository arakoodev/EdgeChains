const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const FFMPEG = 'C:/Users/MyForever/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0.2-full_build/bin/ffmpeg.exe';
const OUTPUT = path.join(__dirname, 'demo_video.mp4');
const FRAMES_DIR = path.join(__dirname, 'frames');

const W = 1920, H = 1080;
const FPS = 30;

// Content - kept concise to fit on screen
const lines = [
  { text: '$ npx ts-node examples/aws-comprehend-redact/index.ts', c: '#4AF626' },
  { text: '', c: '#4AF626' },
  { text: '=== Original Input ===', c: '#4AF626' },
  { text: 'Hi, my name is John Smith. I live at 123 Main Street,', c: '#FFFFFF' },
  { text: 'New York. My email is john.smith@example.com and my', c: '#FFFFFF' },
  { text: 'phone is 555-123-4567. Can you help me with my SSN', c: '#FFFFFF' },
  { text: '123-45-6789?', c: '#FFFFFF' },
  { text: '', c: '#4AF626' },
  { text: '=== Redacted Text ===', c: '#4AF626' },
  { text: 'Hi, my name is [PERSON]. I live at [ADDRESS],', c: '#FFFFFF' },
  { text: '[LOCATION]. My email is [EMAIL] and my phone is', c: '#FFFFFF' },
  { text: '[PHONE_NUMBER]. Can you help me with my SSN [SSN]?', c: '#FFFFFF' },
  { text: '', c: '#4AF626' },
  { text: '=== Detected Entities ===', c: '#4AF626' },
  { text: '[PERSON] "John Smith" (0.99)  [ADDRESS] "123 Main St" (0.97)', c: '#FFD700' },
  { text: '[LOCATION] "New York" (0.95)  [EMAIL] "john.smith@..." (0.98)', c: '#FFD700' },
  { text: '[PHONE] "555-123-4567" (0.96)  [SSN] "123-45-6789" (0.99)', c: '#FFD700' },
  { text: '', c: '#4AF626' },
  { text: '=== LLM Response (redacted input) ===', c: '#4AF626' },
  { text: 'Certainly! I can help with your question. Since all', c: '#87CEEB' },
  { text: 'personal information has been redacted, please provide', c: '#87CEEB' },
  { text: 'additional context about what you\'d like to know.', c: '#87CEEB' },
  { text: '', c: '#4AF626' },
  { text: '\u2713 PII redaction complete. 6 entities detected and masked.', c: '#4AF626' },
];

// Layout: title bar 50px, content starts at 70px, line height 38px
// 24 lines * 38 = 912px + 70 = 982px (fits in 1080 with footer)
const TITLE_H = 50;
const CONTENT_START_Y = 75;
const LINE_H = 38;
const FONT_SIZE = 22;

function makeSvg(visibleLines, cursorLine, cursorChar) {
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">`;
  svg += `<rect width="${W}" height="${H}" fill="#1a1a2e"/>`;
  // Title bar
  svg += `<rect width="${W}" height="${TITLE_H}" fill="#16213e"/>`;
  svg += `<text x="30" y="32" font-family="Consolas,monospace" font-size="24" fill="#e0e0e0">AWS Comprehend PII Redaction \u2014 EdgeChains Demo</text>`;
  // Footer bar
  svg += `<rect y="${H-35}" width="${W}" height="35" fill="#16213e"/>`;
  svg += `<text x="30" y="${H-12}" font-family="Consolas,monospace" font-size="16" fill="#888888">edgechains/aws-comprehend-redact  |  Node.js + AWS Comprehend</text>`;
  
  // Terminal lines with typing effect
  visibleLines.forEach((line, i) => {
    const y = CONTENT_START_Y + i * LINE_H;
    if (y > H - 50) return;
    
    let displayText = line.text;
    let isCursorLine = (i === cursorLine);
    
    // Typing effect: only show up to cursorChar on the active line
    if (isCursorLine) {
      displayText = line.text.substring(0, cursorChar);
    }
    
    if (displayText) {
      const escaped = displayText
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
      svg += `<text x="30" y="${y}" font-family="Consolas,monospace" font-size="${FONT_SIZE}" fill="${line.c}">${escaped}</text>`;
    }
    
    // Blinking cursor on active line
    if (isCursorLine && cursorChar % 6 < 3) {
      const cursorX = 30 + displayText.length * 13.2; // approx char width for Consolas 22px
      svg += `<rect x="${cursorX}" y="${y - 18}" width="10" height="24" fill="#4AF626" opacity="0.8"/>`;
    }
  });
  
  svg += `</svg>`;
  return svg;
}

async function main() {
  fs.rmSync(FRAMES_DIR, { recursive: true, force: true });
  fs.mkdirSync(FRAMES_DIR, { recursive: true });
  
  // Build frame sequence with smooth typing
  const frameSpecs = [];
  let frameNum = 0;
  
  // Initial pause (0.5s)
  for (let f = 0; f < FPS / 2; f++) {
    frameSpecs.push({ num: frameNum++, svg: makeSvg([], -1, 0) });
  }
  
  // Type each line character by character
  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    const visible = lines.slice(0, lineIdx + 1);
    
    if (line.text === '') {
      // Empty line: just show it briefly (0.3s)
      for (let f = 0; f < FPS * 0.3; f++) {
        frameSpecs.push({ num: frameNum++, svg: makeSvg(visible, lineIdx, 0) });
      }
      continue;
    }
    
    // Type characters: ~3 chars per frame for smooth effect
    const charsPerFrame = 3;
    const totalCharFrames = Math.ceil(line.text.length / charsPerFrame);
    
    for (let cf = 0; cf < totalCharFrames; cf++) {
      const charsShown = Math.min((cf + 1) * charsPerFrame, line.text.length);
      // Repeat each char-state for 2 frames to slow it down
      for (let rep = 0; rep < 2; rep++) {
        frameSpecs.push({ num: frameNum++, svg: makeSvg(visible, lineIdx, charsShown) });
      }
    }
    
    // Brief pause after each line (0.2s)
    for (let f = 0; f < FPS * 0.2; f++) {
      frameSpecs.push({ num: frameNum++, svg: makeSvg(visible, lineIdx, line.text.length) });
    }
  }
  
  // Hold final frame (2s)
  for (let f = 0; f < FPS * 2; f++) {
    frameSpecs.push({ num: frameNum++, svg: makeSvg(lines, -1, 0) });
  }
  
  console.log(`Total frames: ${frameNum} (${(frameNum / FPS).toFixed(1)}s)`);
  
  // Write frames in batches
  let written = 0;
  for (let i = 0; i < frameSpecs.length; i += 15) {
    const batch = frameSpecs.slice(i, i + 15);
    await Promise.all(batch.map(async fs => {
      const framePath = path.join(FRAMES_DIR, `frame_${String(fs.num).padStart(4, '0')}.png`);
      await sharp(Buffer.from(fs.svg)).png().toFile(framePath);
    }));
    written += batch.length;
    if (written % 150 === 0) console.log(`  ${written}/${frameSpecs.length} frames`);
  }
  
  console.log('Encoding to MP4...');
  const inputPattern = path.join(FRAMES_DIR, 'frame_%04d.png').replace(/\\/g, '/');
  const cmd = `${FFMPEG} -y -framerate ${FPS} -i "${inputPattern}" -c:v libx264 -preset fast -crf 20 -pix_fmt yuv420p -r ${FPS} "${OUTPUT}"`;
  
  try {
    execSync(cmd, { timeout: 180000, stdio: 'pipe' });
    const stats = fs.statSync(OUTPUT);
    console.log('Video created:', OUTPUT);
    console.log('Size:', (stats.size / 1024 / 1024).toFixed(2), 'MB');
    console.log('Duration:', (frameNum / FPS).toFixed(1), 'seconds');
  } catch (e) {
    const err = e.stderr ? e.stderr.toString() : e.message;
    console.error('ffmpeg error:', err.slice(-500));
  }
  
  fs.rmSync(FRAMES_DIR, { recursive: true, force: true });
}

main().catch(e => console.error('FATAL:', e.message));