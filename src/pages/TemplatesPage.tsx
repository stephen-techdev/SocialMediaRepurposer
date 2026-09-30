import React, { useState } from 'react';
import { TEMPLATE_CATEGORIES } from '../lib/constants';
import { useToast } from '../hooks/useToast';
import { ToastContainer } from '../components/Toast';
import {
  Megaphone,
  GraduationCap,
  Cpu,
  Briefcase,
  User,
  Dumbbell,
  UtensilsCrossed,
  Plane,
  Shirt,
  Newspaper,
  Home,
  DollarSign,
  Copy,
  Check,
  Search,
  Filter,
} from 'lucide-react';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Megaphone,
  GraduationCap,
  Cpu,
  Briefcase,
  User,
  Dumbbell,
  UtensilsCrossed,
  Plane,
  Shirt,
  Newspaper,
  Home,
  DollarSign,
};

const CATEGORY_TEMPLATES: Record<string, { title: string; content: string }[]> = {
  marketing: [
    { title: 'Product Launch', content: 'Introducing our latest innovation! Discover how [Product Name] is revolutionizing [Industry]. Key features include: [Feature 1], [Feature 2], and [Feature 3]. Early adopters get [Special Offer]. Available now at [Link].' },
    { title: 'Limited Time Offer', content: 'Don\'t miss out! For the next [Time Period], get [Discount/Offer] on [Product/Service]. Use code [CODE] at checkout. Terms apply. Shop now: [Link]' },
    { title: 'Customer Success Story', content: 'Meet [Customer Name]! They achieved [Result] using our [Product/Service]. "Your story starts here too - [Call to Action]" Read their full story: [Link]' },
  ],
  education: [
    { title: 'Study Tips', content: 'Struggling with [Subject]? Here are 5 proven strategies: 1. [Tip 1] 2. [Tip 2] 3. [Tip 3] 4. [Tip 4] 5. [Tip 5]. Save this for later!' },
    { title: 'Course Announcement', content: 'New Course Alert! Learn [Topic] from basics to advanced. What you\'ll master: [Skill 1], [Skill 2], [Skill 3]. Enroll now: [Link]' },
    { title: 'Educational Insight', content: 'Did you know? [Interesting Fact]. This matters because [Explanation]. Learn more about [Topic] in our latest resource: [Link]' },
  ],
  technology: [
    { title: 'Tech Update', content: 'Breaking: [Company/Product] just announced [News]. This changes everything because [Impact]. What are your thoughts? Comment below!' },
    { title: 'Tutorial Post', content: 'How to [Task] in [Minutes] minutes: Step 1: [Action 1] Step 2: [Action 2] Step 3: [Action 3] Pro tip: [Expert Advice] Full guide: [Link]' },
    { title: 'Product Review', content: 'Honest Review: [Product] after [Time Period] of use. Pros: [Pro 1], [Pro 2] Cons: [Con 1] Verdict: [Rating]/10. Questions? Ask below!' },
  ],
  business: [
    { title: 'Company Update', content: 'Exciting news from [Company]! We\'re proud to announce [Update]. This represents [Impact/Benefit]. Thank you to our [Team/Customers] for making this possible.' },
    { title: 'Industry Insight', content: 'The future of [Industry] is here. Key trends we\'re seeing: 1. [Trend 1] 2. [Trend 2] 3. [Trend 3]. How are you adapting? Share your thoughts!' },
    { title: 'Team Spotlight', content: 'Meet our amazing team! Today we\'re featuring [Name], [Role]. Fun fact: [Interesting Detail]. Their advice for [Audience]: [Quote]. #TeamAppreciation' },
  ],
  personal: [
    { title: 'Life Update', content: 'Personal update: After [Time Period], I\'ve decided to [Decision]. The journey taught me [Lesson]. Grateful for [Acknowledgment]. Here\'s to the next chapter!' },
    { title: 'Achievement Share', content: 'Milestone unlocked! [Achievement]. What I learned: [Insight 1], [Insight 2], [Insight 3]. The secret? [Key Strategy]. Dream big, start small!' },
    { title: 'Reflection Post', content: 'Thinking about [Topic] today. It\'s [Adjective] how [Observation]. I\'ve realized [Insight]. What\'s your perspective? Let\'s discuss in the comments.' },
  ],
  fitness: [
    { title: 'Workout Share', content: 'Today\'s workout: [Workout Type] Duration: [Time] Calories: [Number] Feeling: [Mood]. Drop a "strong" if you crushed your workout too!' },
    { title: 'Motivation Monday', content: 'Your Monday motivation: "Your body can stand almost anything. It\'s your mind you have to convince." Today\'s goal: [Specific Goal]. Let\'s get it!' },
    { title: 'Progress Update', content: '[Time Period] progress check! Starting: [Starting Point] Current: [Current Status] Goal: [Target]. The grind continues! #FitnessJourney' },
  ],
  food: [
    { title: 'Recipe Share', content: 'Tonight\'s dinner: [Dish Name] Why you\'ll love it: [Benefit 1] Prep time: [Time] Ingredients: [List]. Full recipe in bio!' },
    { title: 'Restaurant Review', content: 'Tried [Restaurant Name] and WOW! Must-try: [Dish 1], [Dish 2] Atmosphere: [Description] Price: [Range]/5 Rating: [Score]/5 Would recommend!' },
    { title: 'Cooking Tip', content: 'Game-changer alert! For perfect [Food Item]: 1. [Tip 1] 2. [Tip 2] 3. [Tip 3] Trust me, this makes all the difference. Save this tip!' },
  ],
  travel: [
    { title: 'Destination Spotlight', content: 'Discover [Location]! Must-do: [Activity 1], [Activity 2] Best time to visit: [Season] Budget tip: [Advice] Have you been? Share your experience!' },
    { title: 'Travel Diary', content: 'Day [Number] in [Location]: Today\'s highlights: [Experience 1], [Experience 2] Unexpected discovery: [Surprise] Favorite moment: [Memory]' },
    { title: 'Tips Post', content: '5 things I wish I knew before visiting [Place]: 1. [Tip 1] 2. [Tip 2] 3. [Tip 3] 4. [Tip 4] 5. [Tip 5]. Save for your next trip!' },
  ],
  fashion: [
    { title: 'OOTD', content: 'Today\'s look: [Style Description] Details: [Item 1] - [Brand] [Item 2] - [Brand] [Item 3] - [Brand] What\'s your style today?' },
    { title: 'Style Tips', content: 'How to elevate your [Style Type]: 1. [Tip 1] 2. [Tip 2] 3. [Tip 3] Confidence is the best accessory. What\'s your go-to style trick?' },
    { title: 'Trend Alert', content: '[Season] trend alert! [Trend Name] is everywhere and here\'s how to style it: [Style 1], [Style 2], [Style 3]. Are you trying this trend?' },
  ],
  news: [
    { title: 'Breaking News', content: 'BREAKING: [Headline] What we know: [Key Fact 1] [Key Fact 2] [Key Fact 3]. Developing story - follow for updates.' },
    { title: 'Weekly Roundup', content: 'This week\'s top stories: 1. [Story 1] 2. [Story 2] 3. [Story 3] Read more at [Link]. What caught your attention?' },
    { title: 'Opinion Piece', content: 'Hot take: [Opinion Statement]. Here\'s why: [Reason 1], [Reason 2], [Reason 3]. Agree or disagree? Sound off below!' },
  ],
  real_estate: [
    { title: 'Property Feature', content: 'Just listed! [Property Type] in [Location] Features: [Feature 1], [Feature 2], [Feature 3] Price: [Price] Link in bio for details!' },
    { title: 'Market Update', content: '[Location] real estate market update: Average price: [Price] Days on market: [Number] Trend: [Direction] What buyers/sellers need to know: [Advice]' },
    { title: 'Home Tips', content: 'Boost your home\'s value with these tips: 1. [Tip 1] 2. [Tip 2] 3. [Tip 3] ROI potential: [Benefits]. Questions about your area? DM me!' },
  ],
  finance: [
    { title: 'Money Tip', content: 'Money Monday tip: [Tip Title] The strategy: [Explanation] Why it works: [Reason] Start today: [Action Step]. Your future self will thank you!' },
    { title: 'Investment Insight', content: 'Understanding [Investment Type]: What it is: [Definition] Pros: [Advantage 1], [Advantage 2] Cons: [Disadvantage] Always do your own research!' },
    { title: 'Savings Hack', content: 'Save [Amount] with this hack: Step 1: [Action 1] Step 2: [Action 2] Step 3: [Action 3] Total potential savings: [Number]. Try it this month!' },
  ],
};

export function TemplatesPage({ onSelectTemplate }: { onSelectTemplate?: (content: string) => void }) {
  const { toasts, success, removeToast } = useToast();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = async (templateId: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(templateId);
      success('Template copied to clipboard!');
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Error handling
    }
  };

  const filteredCategories = searchQuery
    ? TEMPLATE_CATEGORIES.filter(cat =>
        cat.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : TEMPLATE_CATEGORIES;

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <div className="mb-8">
        <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Content Templates
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Pre-built templates to jumpstart your content creation
        </p>
      </div>

      <div className="relative mb-8">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search templates..."
          className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {!selectedCategory ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredCategories.map(category => {
            const Icon = ICON_MAP[category.icon] || Megaphone;
            const templateCount = CATEGORY_TEMPLATES[category.id]?.length || 0;

            return (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className="group bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 hover:shadow-xl hover:shadow-gray-200/50 dark:hover:shadow-none transition-all text-left"
              >
                <div
                  className={`w-14 h-14 rounded-xl bg-gradient-to-br ${category.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}
                >
                  <Icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                  {category.name}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {templateCount} templates
                </p>
              </button>
            );
          })}
        </div>
      ) : (
        <div>
          <button
            onClick={() => setSelectedCategory(null)}
            className="flex items-center gap-2 text-blue-500 hover:text-blue-600 mb-6 transition-colors"
          >
            <span className="transform -rotate-180">
              <Filter className="w-4 h-4" />
            </span>
            Back to categories
          </button>

          <div className="grid gap-4">
            {CATEGORY_TEMPLATES[selectedCategory]?.map((template, index) => {
              const templateId = `${selectedCategory}-${index}`;
              const isCopied = copiedId === templateId;

              return (
                <div
                  key={templateId}
                  className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-shadow"
                >
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {template.title}
                    </h3>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleCopy(templateId, template.content)}
                        className={`p-2 rounded-lg transition-colors ${
                          isCopied
                            ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }`}
                      >
                        {isCopied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                  <p className="text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                    {template.content}
                  </p>
                  {onSelectTemplate && (
                    <button
                      onClick={() => onSelectTemplate(template.content)}
                      className="mt-4 px-4 py-2 rounded-lg bg-blue-500 text-white font-medium hover:bg-blue-600 transition-colors"
                    >
                      Use This Template
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
