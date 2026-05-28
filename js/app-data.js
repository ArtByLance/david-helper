export const MEALS = [
  { id: "breakfast", label: "BREAKFAST", time: "07:00", displayTime: "7:00 AM" },
  { id: "lunch", label: "LUNCH", time: "12:00", displayTime: "12:00 PM" },
  { id: "supper", label: "SUPPER", time: "17:00", displayTime: "5:00 PM" },
];

export const TODAY_SPECIALS = {
  wednesday: {
    title: "Bible Study",
    time: "10:30 AM",
    place: "Movie Room",
    note: "Bible Study is today in the Movie Room.",
  },
  friday: {
    title: "Laundry and Cleaning",
    time: "Today",
    place: "Your room",
    note: "Laundry Day and Room Cleaning Day are today.",
  },
  sunday: {
    title: "Church Service",
    time: "10:30 AM",
    place: "Chapel",
    note: "Church Service is today at 10:30.",
  },
};

const COWBOY_PAGES = [
  "A rider comes into a dusty town and notices that everyone is speaking softly. Something has made the town uneasy.",
  "At the stable, he hears that a ranch fence was cut during the night. Two families blame each other, and both are ready for a fight.",
  "The rider visits the creek and studies the tracks. He sees one horse was missing a shoe, and the marks lead away from both ranches.",
  "He talks with the sheriff and asks him to wait before arresting anyone. The sheriff agrees because the rider speaks plainly and calmly.",
  "The rider follows the tracks to an old shed near the dry wash. Inside, he finds wire cutters and a frightened young hand hiding there.",
  "The young hand admits he was paid by a gambler to start trouble. The gambler wanted both ranches weak so he could buy their land.",
  "At the meeting hall, the rider tells the truth in front of both families. He keeps his voice steady so everyone can hear.",
  "The gambler tries to slip out, but the sheriff is waiting by the door. The town sees that the trouble was planned by one greedy man.",
  "The two ranch families mend the fence together the next morning. It is slow work, but nobody raises a hand in anger.",
  "By sunset, the rider leaves town. The creek is quiet again, and the people remember that patience saved them from a needless fight.",
];

const WAR_PAGES = [
  "The patrol waits before dawn, listening for the first sound of movement. Everyone knows the morning will ask courage from them.",
  "Their captain studies the map by a shaded lamp. The road ahead is narrow, and the men must move carefully.",
  "A young soldier checks on his friend, who is afraid but trying not to show it. They speak quietly about home.",
  "The patrol moves out when the sky turns gray. Boots press into wet ground, and every man watches the tree line.",
  "Trouble starts near the ridge, and the captain orders everyone to take cover. The men remember their training.",
  "One soldier carries a message across an open stretch. He is scared, but he keeps going because the others need the warning.",
  "The message reaches the radio team just in time. Help is sent to the right place, and the patrol holds together.",
  "By afternoon, the danger has passed. The men are tired and quiet, but they know they did their duty.",
  "That night, they share coffee from tin cups. Nobody says much, but each man understands what the others carried.",
  "The next day begins with sunlight on the ridge. The patrol moves on, grateful for courage, friendship, and another morning.",
];

const BIBLE_PAGES = [
  "A family faces a hard season, and one person must trust God even when the path is not clear.",
  "The person is treated unfairly, but he does not give up. He keeps doing what is right in the place where he is.",
  "Time passes slowly. Some days feel forgotten, but God is still working even when nobody can see it.",
  "A chance comes to help someone else. The person uses wisdom, patience, and honesty.",
  "Important people begin to notice that God has given him understanding. His life starts to change.",
  "He is given responsibility because he can be trusted. He remembers that the gift came from God.",
  "A great need comes to the land, and many people are afraid. The person prepares carefully and helps them.",
  "Old hurts return when family members appear again. Forgiveness is not easy, but God has softened his heart.",
  "The family is brought back together. What was meant for harm becomes part of God's good plan.",
  "The story ends with peace and provision. God was faithful through every hidden and difficult day.",
];

const ACTION_PAGES = [
  "The mission begins with a simple warning: a bridge is out, and a whole town may be cut off by nightfall.",
  "A small team gathers supplies and heads toward the hills. The road is rough, but they know people are waiting.",
  "Rain starts falling hard. Mud pulls at the tires, and the driver has to keep the truck steady.",
  "They find an old service road and decide to try it. The map is not perfect, but the leader stays calm.",
  "At the ravine, they build a rope guide and pass the supplies across one crate at a time.",
  "A radio call comes through with worse news: medicine is needed before morning. The team cannot turn back.",
  "They push through the last mile on foot. Each person carries what they can, and nobody complains.",
  "Lights from the town appear through the rain. People come out with lanterns and guide the team in.",
  "The medicine arrives in time. The tired team sits down while the town doctor goes to work.",
  "By morning, the storm has moved on. The team heads home knowing that steady courage made the difference.",
];

export const READ_CONTENT = [
  makeBook("long-rider", "Long Rider", "COWBOY STORIES", COWBOY_PAGES),
  makeBook("dry-creek-sheriff", "Dry Creek Sheriff", "COWBOY STORIES", COWBOY_PAGES),
  makeBook("ranch-war", "Ranch War", "COWBOY STORIES", COWBOY_PAGES),
  makeBook("sniper-hill", "Sniper Hill", "WAR STORIES", WAR_PAGES),
  makeBook("pacific-patrol", "Pacific Patrol", "WAR STORIES", WAR_PAGES),
  makeBook("tank-crew", "Tank Crew", "WAR STORIES", WAR_PAGES),
  makeBook("joseph", "Joseph", "BIBLE STORIES", BIBLE_PAGES),
  makeBook("david-and-goliath", "David and Goliath", "BIBLE STORIES", BIBLE_PAGES),
  makeBook("pauls-journey", "Paul's Journey", "BIBLE STORIES", BIBLE_PAGES),
  makeBook("bridge-rescue", "Bridge Rescue", "ACTION STORIES", ACTION_PAGES),
  makeBook("mountain-road", "Mountain Road", "ACTION STORIES", ACTION_PAGES),
];

export const WATCH_CONTENT = [
  {
    id: "frasier",
    title: "Frasier",
    category: "TV SHOWS",
    type: "show",
    playbackProvider: "voicemonkey",
    playbackAction: "play_frasier",
    description: "A familiar comedy show.",
  },
  {
    id: "bones",
    title: "Bones",
    category: "TV SHOWS",
    type: "show",
    playbackProvider: "voicemonkey",
    playbackAction: "play_bones",
    description: "A mystery show with familiar characters.",
  },
  {
    id: "andy-griffith",
    title: "Andy Griffith",
    category: "TV SHOWS",
    type: "show",
    playbackProvider: "voicemonkey",
    playbackAction: "play_andy_griffith",
    description: "A gentle old favorite.",
  },
  {
    id: "western",
    title: "Western Movie",
    category: "MOVIES",
    type: "movie",
    playbackProvider: "voicemonkey",
    playbackAction: "play_western_movie",
    description: "A cowboy movie for the afternoon.",
  },
  {
    id: "war-movie",
    title: "War Movie",
    category: "MOVIES",
    type: "movie",
    playbackProvider: "voicemonkey",
    playbackAction: "play_war_movie",
    description: "A steady old war movie.",
  },
  {
    id: "comedy-movie",
    title: "Comedy Movie",
    category: "MOVIES",
    type: "movie",
    playbackProvider: "voicemonkey",
    playbackAction: "play_comedy_movie",
    description: "A light movie with easy laughs.",
  },
  {
    id: "gospel",
    title: "Gospel Music",
    category: "MUSIC",
    type: "music",
    playbackProvider: "voicemonkey",
    playbackAction: "play_gospel_music",
    description: "Familiar gospel music.",
  },
  {
    id: "calm-music",
    title: "Calm Music",
    category: "MUSIC",
    type: "music",
    playbackProvider: "voicemonkey",
    playbackAction: "play_calm_music",
    description: "Quiet music for resting.",
  },
];

function makeBook(id, title, category, pages) {
  return {
    id,
    title,
    category,
    type: "book",
    description: `${title} is a familiar ${category.toLowerCase()} recap story.`,
    pages,
  };
}
