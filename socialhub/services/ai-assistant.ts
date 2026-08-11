export const AI_PROMPTS = [
  {
    category: "Bio Optimization",
    suggestion: "Suggest a premium bio",
    response: `🤖 *AI Profile Coach:* I've analyzed your niche (Travel & Creator) and drafted a highly-optimized bio that drives 2.4x more conversions:\n\n✨ **Ali Hassan**\n📸 Photographer | Traveler | Storyteller\n✈️ Exploring the unseen corners of Pakistan 🇵🇰\n💫 Level 27 Explorer • 24-day Streak! 🔥\n👇 Check my latest travel stories:\n🔗 *linktr.ee/alihassan_07*`
  },
  {
    category: "Content Ideas",
    suggestion: "Get next post ideas",
    response: `🤖 *AI Profile Coach:* Based on your current audience peak engagement times in Pakistan (8:00 PM PST), here are 3 high-impact post ideas:\n\n1. **Behind the Lens Reels 📸**: A fast-paced 7-second reel revealing your color-grading workflow for the Hunza Valley sunset photo.\n2. **Weekly Travel Guide 🗺️**: A carousel of the 'Top 5 Hidden Campsites in Lahore & Surrounds' (Your audience loves local adventure!).\n3. **Interactive Story Poll 🗳️**: 'Where should I shoot next?' (Option A: Skardu, Option B: Swat). This will boost your engagement rate by +14.2%!`
  },
  {
    category: "Hashtags Strategy",
    suggestion: "Trending travel hashtags",
    response: `🤖 *AI Profile Coach:* Here is a high-yield hashtag recipe tailored to your profile size (2.4K followers). Mix these to bypass the algorithm filter:\n\n🚀 **High Vol (1M+):** #travelphotography #explorepakistan #naturelovers\n📈 **Mid Vol (100K-500K):** #beautifulpakistan #lahorephotographer #explorerlevel27\n🎯 **Niche (10K-50K):** #alihassantravels #socialhubpioneer #hunzadiaries`
  },
  {
    category: "Profile Review",
    suggestion: "Analyze profile strength",
    response: `🤖 *AI Profile Coach:* Complete Audit Results for **@alihassan_07**:\n\n📈 **Growth Velocity:** +18.6% profile views this month. Excellent trajectory!\n🎯 **Audience Match:** 68% in Pakistan, strongly aligned with travel/photography content.\n💡 **Optimization Score:** 92/100.\n⚠️ **Recommendation:** Your email is verified, but adding a custom profile frame (Sunset Theme) will increase avatar click-rates in search feeds by 18%!`
  }
];

export const getAIResponse = (message: string): string => {
  const normalized = message.toLowerCase();
  
  if (normalized.includes("bio") || normalized.includes("profile")) {
    return AI_PROMPTS[0].response;
  }
  if (normalized.includes("idea") || normalized.includes("post") || normalized.includes("next")) {
    return AI_PROMPTS[1].response;
  }
  if (normalized.includes("hashtag") || normalized.includes("tag") || normalized.includes("trend")) {
    return AI_PROMPTS[2].response;
  }
  if (normalized.includes("analyze") || normalized.includes("score") || normalized.includes("audit") || normalized.includes("strength")) {
    return AI_PROMPTS[3].response;
  }

  return `🤖 *AI Profile Coach:* I'm Ali's AI Profile Assistant! I can help you:
  
  1. 📝 *Optimize your Bio* (type 'bio')
  2. 📸 *Get post ideas* (type 'post' or 'idea')
  3. 🏷️ *Get customized hashtags* (type 'hashtag')
  4. 📊 *Analyze profile strength* (type 'analyze')
  
  What can I assist you with today? Type any keyword above!`;
};
