export const INITIAL_BRAND_PROFILE = {
  tone: "Direct, authoritative, zero-fluff practitioner",
  vocabulary: ["clarity", "practical", "real results", "playbook", "proof"],
  style: "Short punchy sentences. Conversational hooks. No cheesy sales hype.",
  learnedRules: [
    {
      id: "rule-1",
      rule: "Open with a bold claim or contrarian observation in the first 10 words.",
      preferenceType: "Writing Style",
      patternCount: 3,
      updatedAt: "Baseline",
    },
    {
      id: "rule-2",
      rule: "Use concrete numbers and real customer examples over vague adjectives.",
      preferenceType: "Vocabulary",
      patternCount: 2,
      updatedAt: "Baseline",
    },
  ],
};

export const SAMPLE_RECORDINGS = [
  {
    id: "rec-1",
    fileName: "Why_Boosting_Instagram_Posts_Wastes_Money.mp4",
    extractedTitle: "Why Boosting Instagram Posts Wastes Money",
    format: "MP4",
    fileSize: "148.4 MB",
    duration: "24:18",
    transcript: `[00:00] Speaker: Everybody asks me, "Should I boost my Instagram post for 500 rupees?" Honestly, boosting a post is the fastest way to donate money to Meta without getting a single real customer.
[02:15] Speaker: Here is what actually happens when you hit that blue Boost button. You are optimizing for cheap likes from people scrolling at 1 AM, not high-intent buyers in your neighborhood.
[05:40] Speaker: Instead, take one real question a customer asked you in person today. Turn on your phone camera for 45 seconds and answer it plainly. No fancy transitions, no trending audio.
[09:12] Speaker: Last month, a dental clinic stopped running generic discount ads and posted three simple myth-busting videos about root canal pain. Their consultation bookings jumped 3x in three weeks.
[14:30] Speaker: Your content doesn't need to go viral across country. It needs to be saved and shared by 500 people within 5 kilometers of your door.`,
    clips: [
      {
        id: "clip-101",
        rank: 1,
        title: "Why Boosting Posts Burns Cash",
        startTime: "00:00",
        endTime: "00:52",
        engagementScore: 96,
        patternTag: "Myth-Busting",
        quote:
          "Boosting a post is the fastest way to donate money to Meta without getting a single real customer.",
        reason:
          "• Contrarian hook • 3s • High saves — Directly challenges a common habit in the opening 3 seconds; Myth-Busting clips hold our highest save-to-view ratio.",
        platforms: {
          youtube_shorts: {
            hook: "Why Boosted Posts Never Bring Real Customers",
            caption:
              "Here is what actually happens behind the scenes when you boost an Instagram post—and the 45-second camera habit that brings real bookings instead.",
          },
          instagram: {
            hook: "Stop hitting that blue Boost button.",
            caption:
              "Boosting optimizes for 1 AM scrollers, not real local buyers. Answer one real customer question on camera instead. #LocalMarketing #SmallBusinessGrowth #ContentStrategy",
          },
          tiktok: {
            hook: "The fastest way to waste ₹500 on Instagram:",
            caption:
              "Stop boosting posts for cheap likes. Talk directly to the buyers within 5km of your door. #MarketingTips #BusinessOwner",
          },
          linkedin: {
            hook: "Hitting 'Boost Post' is a donation, not a marketing strategy.",
            caption:
              "Most local businesses optimize for cheap vanity likes at 1 AM instead of high-intent buyers in their neighborhood.\n\nTake one real customer question from today, turn on your camera for 45 seconds, and answer it with clarity.\n\nWhat is the #1 question your customers ask before buying?",
          },
        },
      },
      {
        id: "clip-102",
        rank: 2,
        title: "The 5-KM Local Reach Rule",
        startTime: "14:30",
        endTime: "15:18",
        engagementScore: 91,
        patternTag: "Tactical Framework",
        quote:
          "Your content doesn't need to go viral across country. It needs to be saved and shared by 500 people within 5 kilometers of your door.",
        reason:
          "• Local reach rule • 5km • High shares — Reframes vanity metrics into a memorable, hyper-practical rule that drives high LinkedIn shares and bookmark saves.",
        platforms: {
          youtube_shorts: {
            hook: "The 5-KM Rule for Local Business Content",
            caption:
              "Why chasing national virality hurts local service businesses—and the exact 5-kilometer metric to track instead.",
          },
          instagram: {
            hook: "You don't need 100,000 views.",
            caption:
              "You need 500 people within 5 kilometers of your door to save and share your advice. Focus on local proof over viral noise. #LocalBusiness #GrowthPlaybook",
          },
          tiktok: {
            hook: "Forget going viral. Aim for 5 kilometers.",
            caption:
              "500 high-intent neighbors beat 50,000 random views every single time. #SmallBizTips #ContentPlaybook",
          },
          linkedin: {
            hook: "You don't need to go viral across the country.",
            caption:
              "If you run a service business, national views don't pay rent.\n\nYou need 500 high-intent buyers within 5 kilometers of your door to save, share, and trust your playbook.\n\nAre you optimizing for reach or relevance?",
          },
        },
      },
      {
        id: "clip-103",
        rank: 3,
        title: "3x Bookings Without Discount Ads",
        startTime: "09:12",
        endTime: "10:04",
        engagementScore: 87,
        patternTag: "Case Proof",
        quote:
          "A dental clinic stopped running generic discount ads and posted three simple myth-busting videos. Consultation bookings jumped 3x in three weeks.",
        reason:
          "• Concrete proof • 3x bookings • Authority — Real-world proof with specific numbers (3 videos, 3x bookings, 3 weeks) builds immediate practitioner authority.",
        platforms: {
          youtube_shorts: {
            hook: "How 3 Myth-Busting Videos Tripled Clinic Bookings",
            caption:
              "A real-world breakdown of why educational clarity outperforms generic discount ads in just 21 days.",
          },
          instagram: {
            hook: "How 3 simple videos tripled clinic bookings:",
            caption:
              "No discounts. No fancy studio. Just three honest videos answering patient fears. Proof beats promotion every time. #CaseStudy #ServiceBusiness",
          },
          tiktok: {
            hook: "Stop offering discounts to get clients.",
            caption:
              "3 myth-busting videos = 3x bookings in 21 days. Here is why clarity wins. #MarketingProof #BusinessGrowth",
          },
          linkedin: {
            hook: "Discounts attract price shoppers. Clarity attracts ready buyers.",
            caption:
              "Last month, a clinic replaced generic discount ads with three 45-second videos answering common patient fears.\n\nResult: 3x consultation bookings in 21 days.\n\nYour best content is already sitting inside your daily customer conversations.",
          },
        },
      },
    ],
  },
];

export const INITIAL_CALENDAR_ITEMS = [
  {
    id: "cal-1",
    clipTitle: "Why Boosting Posts Burns Cash",
    patternTag: "Myth-Busting",
    platform: "instagram",
    date: "2026-11-18",
    status: "Published",
    hook: "Stop hitting that blue Boost button.",
    caption:
      "Boosting optimizes for 1 AM scrollers, not real local buyers. Answer one real customer question on camera instead.",
    metrics: { views: 14800, likes: 920, comments: 64, shares: 310 },
  },
  {
    id: "cal-2",
    clipTitle: "Studio Mic & Desk Setup",
    patternTag: "Behind-the-Scenes",
    platform: "tiktok",
    date: "2026-11-19",
    status: "Published",
    hook: "How we record 4 weeks of content in 1 hour.",
    caption:
      "Simple mic, window light, and raw notes. Here is our exact desk setup.",
    metrics: { views: 2900, likes: 110, comments: 8, shares: 14 },
  },
  {
    id: "cal-3",
    clipTitle: "3x Bookings Without Discount Ads",
    patternTag: "Case Proof",
    platform: "youtube_shorts",
    date: "2026-11-20",
    status: "Published",
    hook: "How 3 Myth-Busting Videos Tripled Clinic Bookings",
    caption:
      "A real-world breakdown of why educational clarity outperforms generic discount ads in just 21 days.",
    metrics: { views: 9650, likes: 615, comments: 41, shares: 175 },
  },
  {
    id: "cal-4",
    clipTitle: "The 5-KM Local Reach Rule",
    patternTag: "Tactical Framework",
    platform: "linkedin",
    date: "2026-11-22",
    status: "Scheduled",
    hook: "You don't need to go viral across the country.",
    caption:
      "You need 500 high-intent buyers within 5 kilometers of your door to save, share, and trust your playbook.",
    metrics: { views: 0, likes: 0, comments: 0, shares: 0 },
  },
];
