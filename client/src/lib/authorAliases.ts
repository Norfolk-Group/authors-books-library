/**
 * Author Name Normalization
 *
 * Maps every known name variant → one canonical display name.
 * Rules:
 *   1. Canonical name = the most widely recognised form (full name, no middle initials unless
 *      needed to disambiguate, ampersand "&" for co-authors).
 *   2. Variants include: Drive folder suffixes, initials, alternate spellings, co-author order.
 *   3. Avatar and bio lookups MUST call `canonicalName(raw)` before hitting their maps.
 *
 * To add a new alias: append an entry to AUTHOR_ALIASES.
 * To rename a canonical: change the value AND the AUTHOR_PHOTOS / authorBios.json key together.
 */

/** Raw name → canonical display name */
export const AUTHOR_ALIASES: Record<string, string> = {
  // -- Self-referential (canonical → canonical, keeps lookup safe) -------------
  // These are listed implicitly; no entry needed - the fallback returns the input unchanged.

  // -- Drive-folder suffix variants (same person, different specialty strings) --
  "Charles Duhigg - Habits, Productivity & Communication": "Charles Duhigg",
  "Charles Duhigg - Habits, productivity, and willpower": "Charles Duhigg",
  "Eric Topol - Longevity and precision medicine": "Eric Topol",
  "Eric Topol - Digital health, AI, and longevity": "Eric Topol",
  "Hans Peter Bech - Channel Sales - business development, B2B marketing, and international sales strategy":
    "Hans Peter Bech",
  "Hans Peter Bech - B2B channel strategy and global expansion": "Hans Peter Bech",
  "Matthew Dixon - Sales strategy and customer psychology experts": "Matthew Dixon",
  "Matthew Dixon - Customer experience and loyalty": "Matthew Dixon",
  "Nixaly Leonardo - Active listening and communication": "Nixaly Leonardo",
  "Nixaly Leonardo - Therapeutic communication and emotional intelligence": "Nixaly Leonardo",
  "Philipp Dettmer - Science communication and visual learning": "Philipp Dettmer",
  "Philipp Dettmer - Health": "Philipp Dettmer",
  "Scott Brinker - Marketing technology strategy and analysis": "Scott Brinker",
  "Scott Brinker - Marketing technology and agile marketing": "Scott Brinker",
  "Sean Ellis - Growth hacking and startup scaling": "Sean Ellis",
  "Sean Ellis - Growth hacking and product-led growth": "Sean Ellis",
  "Stephen Hawking - Theoretical physics and cosmology": "Stephen Hawking",
  "Stephen Hawking - Cosmology, black holes, theoretical physics": "Stephen Hawking",
  "Sue Hawkes - Leadership development and self-empowerment": "Sue Hawkes",
  "Sue Hawkes - Leadership and organizational performance": "Sue Hawkes",
  "David Brooks - political commentary, social psychology, and cultural analysis - communication":
    "David Brooks",

  // -- Middle-initial / abbreviated name aliases --------------------------------
  "Stephen Covey": "Stephen R. Covey",
  "Robert Cialdini": "Robert B. Cialdini",
  "Geoffrey Moore": "Geoffrey A. Moore",
  "Geoffrey A. Moore": "Geoffrey A. Moore",

  // -- Alternate spelling / typo variants --------------------------------------
  "Brené Brown": "Brene Brown",
  "Steven Hawking": "Stephen Hawking", // common misspelling

  // -- Co-author combined-name → first author canonical (one-author-per-card rule) -------
  // Combined Drive folder names resolve to the primary (first-listed) author.
  // The filteredAuthors logic in Home.tsx splits these into individual cards.
  "Ashvin Vaidyanathan & Ruben Rabago": "Ashvin Vaidyanathan",
  "Ashvin Vaidyanathan and Ruben Rabago": "Ashvin Vaidyanathan",
  "Frances Frei & Anne Morriss": "Frances Frei",
  "Frances Frei and Anne Morriss": "Frances Frei",
  "Colin Bryar & Bill Carr": "Colin Bryar",
  "Colin Bryar and Bill Carr": "Colin Bryar",
  "Roger Fisher & William Ury": "Roger Fisher",
  "Roger Fisher and William Ury": "Roger Fisher",
  "Dan Heath and Chip Heath": "Dan Heath",
  "Kelly Leonard and Tom Yorton": "Kelly Leonard",
  "Jack Stack and Bo Burlingham": "Jack Stack",
  "Bob Burg and John David Mann": "Bob Burg",
  "Aaron Ross and Jason Lemkin": "Aaron Ross",
  "Matthew Dixon & Ted McKenna": "Matthew Dixon",
  "Matthew Dixon and Ted McKenna": "Matthew Dixon",
  "Brent Adamson & Matthew Dixon": "Brent Adamson",
  "Brent Adamson and Matthew Dixon": "Brent Adamson",
  "Matthew Dixon & Brent Adamson": "Matthew Dixon",
  "Matthew Dixon and Brent Adamson": "Matthew Dixon",
  "Matthew Dixon, Nick Toman & Rick DeLisi": "Matthew Dixon",

  // -- Individual co-author canonical names (one-author-per-card rule) ----------
  // Each co-author gets their own card; these ensure clean display names.
  "Jason Lemkin": "Jason Lemkin",
  "Bill Carr": "Bill Carr",
  "Anne Morriss": "Anne Morriss",
  "Bo Burlingham": "Bo Burlingham",
  "Ruben Rabago": "Ruben Rabago",
  "Ted McKenna": "Ted McKenna",
  "Brent Adamson": "Brent Adamson",
  "Nick Toman": "Nick Toman",
  "Rick DeLisi": "Rick DeLisi",
  "William Ury": "William Ury",
  "Chip Heath": "Chip Heath",
  "John David Mann": "John David Mann",
  "Kelly Leonard": "Kelly Leonard",
  "Tom Yorton": "Tom Yorton",

  // -- Suffix-only entries (Drive folders named after books, not authors) -------
  // Map to the author name so bio/avatar lookups still work
  "Aaron Ross and Jason Lemkin - sales strategy, B2B growth, and predictable revenue generation":
    "Aaron Ross",
  "Adam Grant - organizational psychology, workplace culture, and leadership": "Adam Grant",
  "Al Ries - Marketing and positioning strategy": "Al Ries",
  "Alan Dib - Marketing strategy and business growth": "Alan Dib",
  "Alex Hormozi - Business scaling and offer creation": "Alex Hormozi",
  "Alison Wood Brooks - Conversation science and social dynamics": "Alison Wood Brooks",
  "Andrew Ross Sorkin - Financial journalism and Wall Street culture": "Andrew Ross Sorkin",
  "Annie Duke - Decision-making and cognitive bias": "Annie Duke",
  "April Dunford - Product positioning and go-to-market strategy": "April Dunford",
  "Arianna Huffington - Wellness, leadership, and media entrepreneurship": "Arianna Huffington",
  "Ben Horowitz - Startup leadership and venture capital": "Ben Horowitz",
  "Brad Stone - Technology journalism and Amazon history": "Brad Stone",
  "Brian Tracy - Sales, personal development, and goal achievement": "Brian Tracy",
  "Cal Newport - Deep work, digital minimalism, and career strategy": "Cal Newport",
  "Carmine Gallo - Communication, presentations, and storytelling": "Carmine Gallo",
  "Chris Voss - Negotiation and FBI hostage tactics": "Chris Voss",
  "Clayton Christensen - Disruptive innovation and business strategy": "Clayton Christensen",
  "Dale Carnegie - Interpersonal skills and public speaking": "Dale Carnegie",
  "Daniel Kahneman - Behavioral economics and cognitive psychology": "Daniel Kahneman",
  "Daniel Pink - Motivation, sales, and human behavior": "Daniel Pink",
  "David Goggins - Mental toughness and extreme endurance": "David Goggins",
  "David Meerman Scott - Digital marketing and real-time communications": "David Meerman Scott",
  "Derek Sivers - Entrepreneurship, music, and contrarian thinking": "Derek Sivers",
  "Donald Miller - Storytelling, branding, and business clarity": "Donald Miller",
  "Eric Ries - Lean startup methodology and entrepreneurship": "Eric Ries",
  "Frank Slootman - Enterprise software leadership and scaling": "Frank Slootman",
  "Gary Vaynerchuk - Social media marketing and entrepreneurship": "Gary Vaynerchuk",
  "Gino Wickman - entrepreneurship, business leadership, and organizational development":
    "Gino Wickman",
  "Hamilton Helmer - Business Strategy": "Hamilton Helmer",
  "Henry Louis Gates Jr - African American History and literature": "Henry Louis Gates Jr",
  "Houston Howard - Transmedia storytelling and franchise strategy": "Houston Howard",
  "Jack Welch - Corporate leadership and management excellence": "Jack Welch",
  "James Clear - Self Improvement": "James Clear",
  "James Surowiecki - economics, business journalism, and behavioral finance": "James Surowiecki",
  "Jason Harris - branding, advertising, and business leadership": "Jason Harris",
  "Jeb Blount - Sales acceleration and prospecting mastery": "Jeb Blount",
  "Jeff Shannon - Meeting facilitation and leadership development": "Jeff Shannon",
  "Jefferson Fisher - Conflict resolution and confident communication": "Jefferson Fisher",
  "Jim Camp - Decision-based negotiation and assertive strategy": "Jim Camp",
  "Jim Collins - Business leadership and organizational excellence": "Jim Collins",
  "John Doerr - Venture capital, OKRs, climate action": "John Doerr",
  "John Mullins - Startups": "John Mullins",
  "Jonathan Haidt - Moral psychology and political polarization": "Jonathan Haidt",
  "Karen Blumenthal - Nonfiction & Biography": "Karen Blumenthal",
  "Karen Eber - Storytelling, Leadership, and Organizational Culture": "Karen Eber",
  "Keith Ferrazzi - Relationship building and professional networking": "Keith Ferrazzi",
  "Kim Scott - Leadership and Communication": "Kim Scott",
  "Lawrence Weinstein - communication, rhetoric, and writing instructio": "Lawrence Weinstein",
  "Leander Kahney - Apple-focused technology culture biographer": "Leander Kahney",
  "Leil Lowndes - Interpersonal communication and social confidence": "Leil Lowndes",
  "Liz Wiseman - Leadership and talent multipliers": "Liz Wiseman",
  "Malcolm Gladwell - pop psychology, sociology, and cultural commentary": "Malcolm Gladwell",
  "Marcus Aurelius - Philosopher": "Marcus Aurelius",
  "Mark Manson - Self-help and personal philosophy": "Mark Manson",
  "Martin Lindstrom - Branding psychology and consumer behavior expert": "Martin Lindstrom",
  "Mel Robbins - self-help and motivational author": "Mel Robbins",
  "Michael Bungay Stanier - Coaching and leadership development": "Michael Bungay Stanier",
  "Michael Lewis - Financial journalism and narrative nonfiction": "Michael Lewis",
  "Mike Michalowicz - Small business growth and entrepreneurship": "Mike Michalowicz",
  "Mike Smerkle - Entrepreneurial grit and startup mindset": "Mike Smerkle",
  "Morgan Housel - behavioral finance, personal development, and economic psychology":
    "Morgan Housel",
  "Napoleon Hill - Success philosophy and personal achievement": "Napoleon Hill",
  "Nassim Nicholas Taleb - Probability, risk, and uncertainty": "Nassim Nicholas Taleb",
  "Naval Ravikant - Wealth creation and philosophical thinking": "Naval Ravikant",
  "Neil Rackham - Sales methodology and B2B selling": "Neil Rackham",
  "Nir Eyal - Habit formation and product design": "Nir Eyal",
  "Noah Kagan - Growth hacking and entrepreneurship": "Noah Kagan",
  "Noel Tichy - Leadership development and organizational transformation": "Noel Tichy",
  "Patrick Lencioni - Team dynamics and organizational health": "Patrick Lencioni",
  "Peter Northhouse - leadership theory and organizational behavior": "Peter Northhouse",
  "Peter Thiel - Technology entrepreneurship and contrarian thinking": "Peter Thiel",
  "Phil Knight - Sports business and entrepreneurship": "Phil Knight",
  "Ray Dalio - Investing, macroeconomics, and life principles": "Ray Dalio",
  "Ray Kurzweil - Futurism, AI, and human longevity": "Ray Kurzweil",
  "Reid Hoffman - Tech Futurist & LinkedIn Co-Founder": "Reid Hoffman",
  "Rhea Orion - Consensual nonmonogamy and relationship therapy": "Rhea Orion",
  "Richard H. Thaler - Behavioral economics and decision-making psychology":
    "Richard H. Thaler",
  "Richard Koch - Business strategy and the 80/20 principle": "Richard Koch",
  "Rob Fitzpatrick - Startup validation and customer conversations": "Rob Fitzpatrick",
  "Rob Walling - Bootstrapped SaaS entrepreneurship and mentorship": "Rob Walling",
  "Robert B. Cialdini - Behavioral psychology and ethical persuasion": "Robert B. Cialdini",
  "Robert Greene - Power, strategy, and human nature": "Robert Greene",
  "Robert M Grant - Business Strategy": "Robert M Grant",
  "Robin Sharma - Leadership, personal mastery, and life purpose": "Robin Sharma",
  "Ryan Holiday - Stoicism and modern philosophy": "Ryan Holiday",
  "Sam Walton - Retail entrepreneurship and business building": "Sam Walton",
  "Sanjoy Mahajan - Problem Solving and Critical Thinking": "Sanjoy Mahajan",
  "Scott Adams - Persuasion, creativity, and systems thinking": "Scott Adams",
  "Scott Galloway - business and tech author": "Scott Galloway",
  "Seth Godin - Marketing": "Seth Godin",
  "Shankar Vedantam - Behavioral science and unconscious bias": "Shankar Vedantam",
  "Simon Sinek - Business Leadership": "Simon Sinek",
  "Spencer Johnson - Change management and motivational storytelling": "Spencer Johnson",
  "Stephen R Poland - Startups": "Stephen R Poland",
  "Stephen R. Covey - personal development and leadership": "Stephen R. Covey",
  "Steven Bartlett - Entrepreneurship, personal growth, and storytelling": "Steven Bartlett",
  "Steven Pressfield - Creative resistance and the artistic life": "Steven Pressfield",
  "Susin Nielsen - young adult (YA) fiction, middle-grade fiction, and coming-of-age storytelling":
    "Susin Nielsen",
  "Tali Sharot - Neuroscience of optimism and influence": "Tali Sharot",
  "Tim Ferriss - Lifestyle design and performance optimization": "Tim Ferriss",
  "Todd Herman - Performance psychology and alter ego strategy": "Todd Herman",
  "Tom Yorton - Improv-based leadership and communication expert": "Tom Yorton",
  "Tony Robbins - Peak performance and life strategy": "Tony Robbins",
  "Uri Levine - Startup disruption and problem-centric innovation": "Uri Levine",
  "Vanessa Van Edwards - Behavioral science and charisma": "Vanessa Van Edwards",
  "Walter Isaacson - Innovator Biographies & Cultural History": "Walter Isaacson",
  "Will Guidara - hospitality and business author": "Will Guidara",
  "Yuval Noah Harari - Mcaro-History and Futurism": "Yuval Noah Harari",
};

/**
 * Resolve any author name variant to its canonical display name.
 * Falls back to the input string if no alias is found.
 *
 * Usage:
 *   const display = canonicalName(author.name);   // "Matthew Dixon"
 *   const photo   = getAuthorAvatar(display);
 *   const bio     = (authorBios as Record<string,string>)[display];
 */
export function canonicalName(raw: string): string {
  if (!raw) return raw;
  // 1. Direct alias lookup
  if (AUTHOR_ALIASES[raw]) return AUTHOR_ALIASES[raw];
  // 2. Strip " - specialty" suffix and try again
  const dashIdx = raw.indexOf(" - ");
  if (dashIdx !== -1) {
    const base = raw.slice(0, dashIdx).trim();
    if (AUTHOR_ALIASES[base]) return AUTHOR_ALIASES[base];
    return base; // return clean base name even without an explicit alias
  }
  return raw;
}
