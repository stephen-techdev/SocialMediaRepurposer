export const PLATFORMS = [
  { id: 'twitter', name: 'X (Twitter)', charLimit: 280, icon: 'Twitter', kind: 'micro' },
  { id: 'threads', name: 'Threads', charLimit: 500, icon: 'MessageCircle', kind: 'micro' },
  { id: 'snapchat', name: 'Snapchat Spotlight', charLimit: 250, icon: 'Camera', kind: 'micro' },
  { id: 'instagram', name: 'Instagram Caption', charLimit: 2200, icon: 'Instagram', kind: 'visual' },
  { id: 'tiktok', name: 'TikTok Caption', charLimit: 2200, icon: 'Music', kind: 'visual' },
  { id: 'youtube_community', name: 'YouTube Community', charLimit: 2500, icon: 'Youtube', kind: 'community' },
  { id: 'linkedin', name: 'LinkedIn Post', charLimit: 3000, icon: 'Linkedin', kind: 'professional' },
  { id: 'whatsapp', name: 'WhatsApp Status', charLimit: 700, icon: 'MessageSquare', kind: 'messaging' },
  { id: 'telegram', name: 'Telegram Channel', charLimit: 4096, icon: 'Send', kind: 'messaging' },
  { id: 'facebook', name: 'Facebook Post', charLimit: 63206, icon: 'Facebook', kind: 'social' },
  { id: 'pinterest', name: 'Pinterest Pin', charLimit: 500, icon: 'Pin', kind: 'visual' },
  { id: 'reddit', name: 'Reddit Post', charLimit: 40000, icon: 'MessageCircle', kind: 'community' },
  { id: 'youtube_description', name: 'YouTube Description', charLimit: 5000, icon: 'Youtube', kind: 'longform' },
  { id: 'medium', name: 'Medium Article', charLimit: 100000, icon: 'BookOpen', kind: 'longform' },
  { id: 'blogger', name: 'Blog Post', charLimit: 100000, icon: 'PenTool', kind: 'longform' },
] as const;

export const TONES = [
  { id: 'professional', name: 'Professional', description: 'Formal and business-like' },
  { id: 'friendly', name: 'Friendly', description: 'Warm and approachable' },
  { id: 'casual', name: 'Casual', description: 'Relaxed and informal' },
  { id: 'marketing', name: 'Marketing', description: 'Persuasive and sales-focused' },
  { id: 'formal', name: 'Formal', description: 'Academic and structured' },
  { id: 'funny', name: 'Funny', description: 'Humorous and light-hearted' },
  { id: 'inspirational', name: 'Inspirational', description: 'Motivating and uplifting' },
  { id: 'urgent', name: 'Breaking / Urgent', description: 'Fast, factual, newswire style' },
  { id: 'neutral', name: 'Neutral Report', description: 'Straight facts, no opinion' },
] as const;

export const LANGUAGES = [
  { id: 'auto', name: 'Same as input (auto)' },
  { id: 'ta', name: 'Tamil' },
  { id: 'ta_IN', name: 'Tamil (India - Tesser)' },
  { id: 'hi', name: 'Hindi' },
  { id: 'bn', name: 'Bengali' },
  { id: 'te', name: 'Telugu' },
  { id: 'kn', name: 'Kannada' },
  { id: 'ml', name: 'Malayalam' },
  { id: 'mr', name: 'Marathi' },
  { id: 'gu', name: 'Gujarati' },
  { id: 'pa', name: 'Punjabi' },
  { id: 'ur', name: 'Urdu' },
  { id: 'en', name: 'English' },
  { id: 'en_IN', name: 'English (India)' },
  { id: 'es', name: 'Spanish' },
  { id: 'fr', name: 'French' },
  { id: 'de', name: 'German' },
  { id: 'it', name: 'Italian' },
  { id: 'pt', name: 'Portuguese' },
  { id: 'nl', name: 'Dutch' },
  { id: 'ru', name: 'Russian' },
  { id: 'zh', name: 'Chinese (Simplified)' },
  { id: 'ja', name: 'Japanese' },
  { id: 'ko', name: 'Korean' },
  { id: 'ar', name: 'Arabic' },
  { id: 'tr', name: 'Turkish' },
] as const;

/** Who the post is being written for. Drives vocabulary, hook and structure. */
export const AUDIENCES = [
  { id: 'general', name: 'General public', hint: 'Plain language, everyone can follow' },
  { id: 'voters', name: 'Voters / Political', hint: 'Citizens, opinion and accountability focus' },
  { id: 'party_workers', name: 'Party workers / Volunteers', hint: 'Mobilisation, instructions, rally-ready' },
  { id: 'media', name: 'Journalists & Media', hint: 'Headline-first, quotable, factual' },
  { id: 'students', name: 'Students', hint: 'Energetic, exam / career relevant' },
  { id: 'farmers', name: 'Farmers', hint: 'Schemes, MSP, harvest, rural issues' },
  { id: 'shopkeepers', name: 'Shopkeepers & Small Business', hint: 'Trade, loans, local economy' },
  { id: 'professionals', name: 'Working professionals', hint: 'Concise, weekday-evening scroller' },
  { id: 'senior_citizens', name: 'Senior citizens', hint: 'Large type friendly, simple words' },
  { id: 'business', name: 'Business audience', hint: 'Numbers, outcomes, ROI angle' },
  { id: 'defenders', name: 'Party / organisation defenders', hint: 'Assertive, counter-narrative ready' },
] as const;

/** What kind of story this is. Shapes structure far more than the tone does. */
export const CONTENT_TYPES = [
  { id: 'news', name: 'News update', hint: 'Facts first, context second' },
  { id: 'breaking', name: 'Breaking news', hint: 'Immediate, minimal adjectives' },
  { id: 'speech', name: 'Speech / rally', hint: 'Quote-worthy lines, crowd appeal' },
  { id: 'journey', name: 'Visit / tour', hint: 'Travel narrative, visuals to pair with' },
  { id: 'announcement', name: 'Announcement', hint: 'What, when, where, who must act' },
  { id: 'scheme', name: 'Scheme / benefit', hint: 'Eligibility and how to claim' },
  { id: 'opinion', name: 'Opinion / commentary', hint: 'Argument first, then evidence' },
  { id: 'condolence', name: 'Condolence / tribute', hint: 'Respectful, dignified, brief' },
  { id: 'achievement', name: 'Achievement / milestone', hint: 'Celebratory but factual' },
  { id: 'campaign', name: 'Campaign post', hint: 'Persuade, contrast, call to action' },
  { id: 'product', name: 'Product / service', hint: 'Benefits first, objection handling' },
  { id: 'event', name: 'Event invitation', hint: 'Date, venue, RSVP' },
] as const;

/** Opening line strategy - the single biggest lever on engagement. */
export const HOOK_STYLES = [
  { id: 'auto', name: 'Let AI decide', hint: 'Model picks the strongest opener' },
  { id: 'question', name: 'Question', hint: 'Asks the reader directly' },
  { id: 'stat', name: 'Number / Stat', hint: 'Leads with a figure' },
  { id: 'breaking', name: 'Breaking alert', hint: '"BREAKING:" prefix' },
  { id: 'quote', name: 'Quote', hint: 'Pull-quote from a leader' },
  { id: 'story', name: 'Story opening', hint: 'Scene, then the point' },
  { id: 'benefit', name: 'Benefit', hint: 'What is in it for the reader' },
  { id: 'contrast', name: 'Before / After', hint: 'Contrast two states' },
] as const;

/** How long the final post should be, per platform. */
export const LENGTHS = [
  { id: 'short', name: 'Short', hint: 'Punchy - 1 short block' },
  { id: 'standard', name: 'Standard', hint: 'Default social length' },
  { id: 'detailed', name: 'Detailed', hint: 'More context, still platform-safe' },
  { id: 'long', name: 'Long form', hint: 'Article style, for blogs / Medium' },
] as const;

export const EMOJI_DENSITY = [
  { id: 'none', name: 'No emoji' },
  { id: 'light', name: 'Light (1-2)' },
  { id: 'medium', name: 'Medium (3-4)' },
  { id: 'heavy', name: 'Heavy (6+)' },
] as const;

/** Some platforms reject hashtags in the caption body. */
export const HASHTAG_PLACEMENT = [
  { id: 'inline', name: 'Inline in the post' },
  { id: 'separate', name: 'Separate line at the end' },
  { id: 'first_comment', name: 'As a "first comment" block' },
] as const;

export const HASHTAG_SCRIPTS = [
  { id: 'auto', name: 'Auto (keep original script)' },
  { id: 'native', name: 'Original script only' },
  { id: 'roman', name: 'Romanised (English letters)' },
  { id: 'both', name: 'Both native + romanised' },
] as const;

export const CALL_TO_ACTIONS = [
  { id: 'none', name: 'No call to action' },
  { id: 'follow', name: 'Follow the page' },
  { id: 'share', name: 'Share / forward' },
  { id: 'comment', name: 'Ask for comments' },
  { id: 'vote', name: 'Vote / participate' },
  { id: 'link', name: 'Link in bio' },
  { id: 'join', name: 'Join the movement' },
  { id: 'custom', name: 'Custom (write your own)' },
] as const;

export const TEMPLATE_CATEGORIES = [
  { id: 'marketing', name: 'Marketing', icon: 'Megaphone', color: 'from-orange-500 to-red-500' },
  { id: 'education', name: 'Education', icon: 'GraduationCap', color: 'from-blue-500 to-indigo-500' },
  { id: 'technology', name: 'Technology', icon: 'Cpu', color: 'from-cyan-500 to-blue-500' },
  { id: 'business', name: 'Business', icon: 'Briefcase', color: 'from-gray-600 to-gray-800' },
  { id: 'personal', name: 'Personal', icon: 'User', color: 'from-purple-500 to-pink-500' },
  { id: 'fitness', name: 'Fitness', icon: 'Dumbbell', color: 'from-green-500 to-emerald-500' },
  { id: 'food', name: 'Food', icon: 'UtensilsCrossed', color: 'from-amber-500 to-orange-500' },
  { id: 'travel', name: 'Travel', icon: 'Plane', color: 'from-sky-500 to-cyan-500' },
  { id: 'fashion', name: 'Fashion', icon: 'Shirt', color: 'from-pink-500 to-rose-500' },
  { id: 'news', name: 'News', icon: 'Newspaper', color: 'from-slate-500 to-gray-600' },
  { id: 'real_estate', name: 'Real Estate', icon: 'Home', color: 'from-teal-500 to-green-500' },
  { id: 'finance', name: 'Finance', icon: 'DollarSign', color: 'from-emerald-500 to-green-600' },
  { id: 'politics', name: 'Politics', icon: 'Landmark', color: 'from-indigo-500 to-purple-600' },
] as const;

export const AI_TOOLS = [
  { id: 'caption', name: 'Caption Generator', description: 'Generate engaging captions for any platform', icon: 'Type' },
  { id: 'title', name: 'Title Generator', description: 'Create catchy titles for your content', icon: 'Heading' },
  { id: 'headline', name: 'News Headlines', description: 'Write 10 headline variants for a news item', icon: 'Newspaper' },
  { id: 'bio', name: 'Bio Generator', description: 'Craft compelling social media bios', icon: 'UserCircle' },
  { id: 'product', name: 'Product Description', description: 'Write compelling product descriptions', icon: 'Package' },
  { id: 'ad_copy', name: 'Ad Copy Generator', description: 'Create persuasive ad copy', icon: 'Megaphone' },
  { id: 'email', name: 'Email Generator', description: 'Generate marketing emails', icon: 'Mail' },
  { id: 'linkedin', name: 'LinkedIn Post', description: 'Create professional LinkedIn posts', icon: 'Linkedin' },
  { id: 'youtube_title', name: 'YouTube Title', description: 'Generate viral YouTube titles', icon: 'Youtube' },
  { id: 'youtube_desc', name: 'YouTube Description', description: 'Write optimized YouTube descriptions', icon: 'PlayCircle' },
  { id: 'video_script', name: 'Video Script', description: 'Create engaging video scripts', icon: 'Video' },
  { id: 'blog_summary', name: 'Blog Summary', description: 'Summarize blog posts for social media', icon: 'FileText' },
  { id: 'thread', name: 'X / Twitter Thread', description: 'Break a story into a numbered thread', icon: 'ListOrdered' },
  { id: 'quote_card', name: 'Quote Card Text', description: 'Short punchy text for a quote image', icon: 'Quote' },
] as const;

export const CTA_PHRASES = [
  'Click the link in bio!',
  'Share your thoughts below!',
  'Tag someone who needs to see this!',
  'Save this for later!',
  'Double tap if you agree!',
  'Drop a comment!',
  'Follow for more!',
  'Check out our latest post!',
  'Visit our website!',
  'Subscribe now!',
  'Learn more at the link!',
  'Join the conversation!',
];

export const TRENDING_HASHTAGS: Record<string, string[]> = {
  general: ['#trending', '#viral', '#explore', '#fyp', '#follow', '#love', '#instagood'],
  marketing: ['#marketing', '#digitalmarketing', '#branding', '#entrepreneur', '#business', '#growth'],
  technology: ['#technology', '#tech', '#innovation', '#ai', '#coding', '#startup'],
  fitness: ['#fitness', '#gym', '#workout', '#health', '#motivation', '#fitlife'],
  food: ['#food', '#foodie', '#cooking', '#homemade', '#recipe', '#yummy'],
  travel: ['#travel', '#wanderlust', '#adventure', '#explore', '#vacation', '#travelgram'],
  fashion: ['#fashion', '#style', '#ootd', '#fashionista', '#streetstyle', '#instafashion'],
  business: ['#business', '#entrepreneur', '#success', '#startup', '#ceo', '#hustle'],
  education: ['#education', '#learning', '#students', '#teacher', '#knowledge', '#study'],
  politics: ['#politics', '#election', '#voters', '#democracy', '#parliament', '#policy'],
  news: ['#news', '#breakingnews', '#headlines', '#currentaffairs', '#update'],
};

/** Curated, region-aware tag pools used by the offline generator. */
export const REGION_HASHTAGS: Record<string, string[]> = {
  tamilnadu: ['#TamilNadu', '#தமிழ்நாடு', '#TNVote', '#Chennai', '#Coimbatore', '#TamilPolitics'],
  india: ['#India', '#भारत', '#IndianPolitics', '#Bharat', '#Modi', '#IndiaNews'],
  global: ['#BreakingNews', '#WorldNews', '#Headlines'],
};
