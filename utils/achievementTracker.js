import AsyncStorage from "@react-native-async-storage/async-storage";

export const ACHIEVEMENT_DEFINITIONS = [
  {
    id: "listen-1000",
    statKey: "songsListened",
    title: "Ultimate Listener",
    description: "Listen to 1,000 different songs.",
    goal: 1000,
  },
  {
    id: "review-500",
    statKey: "reviewsPosted",
    title: "Master Music Critic",
    description: "Post 500 song reviews.",
    goal: 500,
  },
  {
    id: "reply-500",
    statKey: "repliesPosted",
    title: "Community Voice",
    description: "Reply to 500 reviews.",
    goal: 500,
  },
  {
    id: "like-750",
    statKey: "songsLiked",
    title: "Super Fan",
    description: "Like 750 songs.",
    goal: 750,
  },
  {
    id: "friend-100",
    statKey: "friendsConnected",
    title: "Treble Connector",
    description: "Connect with 100 mutual friends.",
    goal: 100,
  },
  {
    id: "share-250",
    statKey: "songsShared",
    title: "Elite Taste Maker",
    description: "Share 250 songs with friends.",
    goal: 250,
  },
];

export const EMPTY_ACHIEVEMENT_STATS = {
  songsListened: 0,
  reviewsPosted: 0,
  repliesPosted: 0,
  songsLiked: 0,
  friendsConnected: 0,
  songsShared: 0,
};

const listenedKey = (userId) =>
  `treble:achievement:listened:${String(userId || "")}`;

export function mergeAchievementStats(serverStats, localStats) {
  const server = {
    ...EMPTY_ACHIEVEMENT_STATS,
    ...(serverStats || {}),
  };

  const local = {
    ...EMPTY_ACHIEVEMENT_STATS,
    ...(localStats || {}),
  };

  return {
    songsListened: Math.max(
      Number(server.songsListened || 0),
      Number(local.songsListened || 0)
    ),
    reviewsPosted: Number(server.reviewsPosted || 0),
    repliesPosted: Number(server.repliesPosted || 0),
    songsLiked: Number(server.songsLiked || 0),
    friendsConnected: Number(server.friendsConnected || 0),
    songsShared: Number(server.songsShared || 0),
  };
}

export function hasEarnedAchievement(stats) {
  const safeStats = {
    ...EMPTY_ACHIEVEMENT_STATS,
    ...(stats || {}),
  };

  return ACHIEVEMENT_DEFINITIONS.some(
    (achievement) =>
      Number(safeStats[achievement.statKey] || 0) >=
      achievement.goal
  );
}

export function getEarnedAchievementCount(stats) {
  const safeStats = {
    ...EMPTY_ACHIEVEMENT_STATS,
    ...(stats || {}),
  };

  return ACHIEVEMENT_DEFINITIONS.filter(
    (achievement) =>
      Number(safeStats[achievement.statKey] || 0) >=
      achievement.goal
  ).length;
}

export async function getLocalAchievementStats(userId) {
  if (!userId) {
    return EMPTY_ACHIEVEMENT_STATS;
  }

  try {
    const raw = await AsyncStorage.getItem(
      listenedKey(userId)
    );

    const ids = raw ? JSON.parse(raw) : [];

    return {
      ...EMPTY_ACHIEVEMENT_STATS,
      songsListened: Array.isArray(ids)
        ? new Set(ids.map(String)).size
        : 0,
    };
  } catch (error) {
    console.warn(
      "[Achievements] Unable to read local listening progress:",
      error
    );

    return EMPTY_ACHIEVEMENT_STATS;
  }
}

/**
 * Records one unique song for the signed-in user.
 *
 * Call this when a real song is opened/played. Reopening the same track
 * does not increase progress. The server achievement endpoint remains the
 * source of truth when it reports a higher total.
 */
export async function recordUniqueSongListen(
  userId,
  track
) {
  const trackId = String(
    track?.id ||
      track?.listenableId ||
      track?.listenable_id ||
      track?.itemId ||
      track?.item_id ||
      ""
  );

  if (!userId || !trackId) {
    return 0;
  }

  try {
    const key = listenedKey(userId);
    const raw = await AsyncStorage.getItem(key);
    const current = raw ? JSON.parse(raw) : [];
    const uniqueIds = new Set(
      Array.isArray(current)
        ? current.map(String)
        : []
    );

    uniqueIds.add(trackId);

    const next = Array.from(uniqueIds);

    await AsyncStorage.setItem(
      key,
      JSON.stringify(next)
    );

    return next.length;
  } catch (error) {
    console.warn(
      "[Achievements] Unable to record song listen:",
      error
    );

    return 0;
  }
}
