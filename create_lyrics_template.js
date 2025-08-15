// Helper script to create lyrics template from your text
// You can paste your lyrics here and it will generate the JSON structure

const lyricsText = `
// PASTE YOUR JAPANESE LYRICS HERE, ONE LINE PER LINE
// Example:
// 思い出すのは君の歌
// 会話よりも鮮明だ
// どこに行ってしまったの
`;

// Split into lines and create template
const lines = lyricsText.trim().split('\n').filter(line => line.trim() && !line.startsWith('//'));

const lyricsData = {
  metadata: {
    title: "kaiju no hanauta",
    artist: "Vaundy", 
    duration: 224000
  },
  lyrics: lines.map((line, index) => ({
    startTime: 10000 + (index * 5000), // Start at 10s, add 5s per line
    endTime: 15000 + (index * 5000),   // End 5s after start
    japanese: line.trim(),
    romaji: "[Add romaji here]",
    english: "[Add English here]"
  }))
};

console.log(JSON.stringify(lyricsData, null, 2));
