export interface SongInfo {
  id: string;
  title: string;
  titleRomaji: string;
  titleEnglish: string;
  artist: string;
  duration: number; // in milliseconds
}

export const SONGS: SongInfo[] = [
  {
    id: 'vaundy-001',
    title: 'Kaiju no Hanauta',
    titleRomaji: 'Kaiju no Hanauta',
    titleEnglish: 'Monster\'s Flower Song',
    artist: 'Vaundy',
    duration: 224000
  },
  {
    id: 'vaundy-002', 
    title: '踊り子',
    titleRomaji: 'Odoriko',
    titleEnglish: 'Dancer',
    artist: 'Vaundy',
    duration: 230000
  },
  {
    id: 'green-001',
    title: '奇跡',
    titleRomaji: 'Kiseki', 
    titleEnglish: 'Miracle',
    artist: 'GReeeeN',
    duration: 273000
  },
  {
    id: 'motohiro-hata-001',
    title: 'Rain',
    titleRomaji: 'Rain',
    titleEnglish: 'Rain',
    artist: 'Motohiro Hata',
    duration: 282000
  },
  {
    id: 'creepy-nuts-001',
    title: 'Bling-Bang-Bang-Born',
    titleRomaji: 'Bling-Bang-Bang-Born',
    titleEnglish: 'Bling-Bang-Bang-Born',
    artist: 'Creepy Nuts',
    duration: 168000
  }
];

export const getSongById = (id: string): SongInfo | undefined => {
  return SONGS.find(song => song.id === id);
};

export const getNextSong = (currentId: string): SongInfo | null => {
  const currentIndex = SONGS.findIndex(song => song.id === currentId);
  if (currentIndex === -1 || currentIndex === SONGS.length - 1) {
    return SONGS[0]; // Loop back to first song
  }
  return SONGS[currentIndex + 1];
};

export const getPreviousSong = (currentId: string): SongInfo | null => {
  const currentIndex = SONGS.findIndex(song => song.id === currentId);
  if (currentIndex === -1 || currentIndex === 0) {
    return SONGS[SONGS.length - 1]; // Loop to last song
  }
  return SONGS[currentIndex - 1];
};
