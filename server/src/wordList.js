const words = {
  animals: [
    'cat', 'dog', 'elephant', 'giraffe', 'penguin', 'dolphin', 'tiger', 'lion',
    'zebra', 'kangaroo', 'panda', 'koala', 'flamingo', 'crocodile', 'octopus',
    'butterfly', 'eagle', 'shark', 'whale', 'gorilla', 'cheetah', 'wolf',
    'deer', 'fox', 'rabbit', 'squirrel', 'owl', 'parrot', 'turtle', 'frog'
  ],
  objects: [
    'bicycle', 'umbrella', 'telescope', 'guitar', 'keyboard', 'lamp', 'clock',
    'backpack', 'scissors', 'hammer', 'ladder', 'telescope', 'microscope',
    'compass', 'lantern', 'anchor', 'trophy', 'crown', 'ring', 'necklace',
    'suitcase', 'briefcase', 'magnifier', 'paint brush', 'camera', 'headphones',
    'microphone', 'battery', 'globe', 'telescope'
  ],
  food: [
    'pizza', 'hamburger', 'spaghetti', 'sushi', 'taco', 'sandwich', 'hotdog',
    'donut', 'cupcake', 'ice cream', 'watermelon', 'strawberry', 'pineapple',
    'mushroom', 'broccoli', 'avocado', 'pretzel', 'waffle', 'pancake', 'burrito',
    'popcorn', 'chocolate', 'cookie', 'muffin', 'lollipop', 'cheesecake',
    'apple pie', 'french fries', 'grapes', 'lemon'
  ],
  actions: [
    'running', 'jumping', 'swimming', 'climbing', 'dancing', 'singing', 'cooking',
    'painting', 'reading', 'writing', 'driving', 'flying', 'sleeping', 'laughing',
    'crying', 'fishing', 'surfing', 'skating', 'boxing', 'juggling', 'bowling',
    'archery', 'knitting', 'gardening', 'meditating', 'yoga', 'hiking', 'skiing',
    'rowing', 'wrestling'
  ],
  places: [
    'beach', 'mountain', 'forest', 'desert', 'jungle', 'island', 'volcano',
    'waterfall', 'cave', 'lighthouse', 'castle', 'pyramid', 'skyscraper', 'bridge',
    'stadium', 'library', 'museum', 'hospital', 'airport', 'train station',
    'campfire', 'treehouse', 'igloo', 'windmill', 'lighthouse', 'cathedral',
    'observatory', 'aquarium', 'zoo', 'amusement park'
  ],
  vehicles: [
    'airplane', 'helicopter', 'submarine', 'rocket', 'spaceship', 'sailboat',
    'canoe', 'motorcycle', 'scooter', 'tractor', 'bulldozer', 'ambulance',
    'fire truck', 'police car', 'taxi', 'bus', 'train', 'trolley', 'hot air balloon',
    'zeppelin', 'hovercraft', 'jet ski', 'snowmobile', 'tank', 'cargo ship'
  ],
  nature: [
    'rainbow', 'tornado', 'hurricane', 'thunderstorm', 'snowflake', 'icicle',
    'sunset', 'sunrise', 'moon', 'star', 'comet', 'meteor', 'glacier',
    'coral reef', 'mangrove', 'quicksand', 'aurora', 'cliff', 'canyon', 'delta',
    'geyser', 'lagoon', 'oasis', 'tundra', 'prairie', 'swamp', 'bog', 'marsh'
  ],
  fantasy: [
    'dragon', 'unicorn', 'phoenix', 'mermaid', 'werewolf', 'vampire', 'wizard',
    'witch', 'fairy', 'elf', 'dwarf', 'orc', 'goblin', 'troll', 'centaur',
    'minotaur', 'griffin', 'hydra', 'kraken', 'cyclops', 'sphinx', 'chimera',
    'leprechaun', 'gnome', 'banshee', 'ghost', 'zombie', 'skeleton', 'demon', 'angel'
  ]
};

function getRandomWords(count = 3) {
  const allWords = Object.values(words).flat();
  const shuffled = allWords.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

function getWordHint(word, revealCount) {
  const letters = word.split('');
  const hint = letters.map((char, i) => {
    if (char === ' ') return ' ';
    if (i < revealCount) return char;
    return '_';
  });
  return hint.join(' ');
}

module.exports = { words, getRandomWords, getWordHint };
