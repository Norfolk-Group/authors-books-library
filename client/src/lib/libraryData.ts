// NCG Knowledge Library — auto-generated from Google Drive scan
// Generated: 2026-03-15 03:43 UTC
// Design: Editorial Intelligence — Playfair Display + DM Sans, warm paper palette, 9-category system
export interface BookEntry {
  name: string;
  id: string;
  contentTypes: Record<string, number>;
}
export interface AuthorEntry {
  name: string;
  id: string;
  category: string;
  books: BookEntry[];
}
export interface BookRecord {
  name: string;
  id: string;
  category: string;
  contentTypes: Record<string, number>;
}
export const CATEGORY_COLORS: Record<string, string> = {
  "Business & Entrepreneurship": "#FDB817",
  "Behavioral Science & Psychology": "#0091AE",
  "Sales & Negotiation": "#112548",
  "Leadership & Management": "#21B9A3",
  "Self-Help & Productivity": "#F4795B",
  "Communication & Storytelling": "#00A9B8",
  "Technology & Futurism": "#112548",
  "Strategy & Economics": "#34475B",
  "History & Biography": "#6A9E56",
};
// Soft pastel background tints per category (NCG palette-aware)
export const CATEGORY_BG: Record<string, string> = {
  "Business & Entrepreneurship": "#fffbec",
  "Behavioral Science & Psychology": "#edf8fc",
  "Sales & Negotiation": "#eef1f8",
  "Leadership & Management": "#edfaf8",
  "Self-Help & Productivity": "#fef3ef",
  "Communication & Storytelling": "#edfafc",
  "Technology & Futurism": "#eef1f8",
  "Strategy & Economics": "#f5f8fa",
  "History & Biography": "#f1f7ee",
};
export const CATEGORY_ICONS: Record<string, string> = {
  "Business & Entrepreneurship": "briefcase",
  "Behavioral Science & Psychology": "brain",
  "Sales & Negotiation": "handshake",
  "Leadership & Management": "users",
  "Self-Help & Productivity": "zap",
  "Communication & Storytelling": "message-circle",
  "Technology & Futurism": "cpu",
  "Strategy & Economics": "trending-up",
  "History & Biography": "book-open",
};
export const CONTENT_TYPE_ICONS: Record<string, string> = {
  "PDF": "file-text",
  "Binder": "book",
  "Transcript": "align-left",
  "Summary": "list",
  "Supplemental": "package",
  "Video": "video",
  "Images": "image",
  "Papers": "scroll",
  "Articles": "newspaper",
  "Links": "link",
  "Other": "folder",
};
export const CONTENT_TYPE_COLORS: Record<string, string> = {
  "PDF": "#dc2626",
  "Binder": "#7c3aed",
  "Transcript": "#059669",
  "Summary": "#0891b2",
  "Supplemental": "#6b7280",
  "Video": "#db2777",
  "Images": "#0891b2",
  "Papers": "#0d9488",
  "Articles": "#78350f",
  "Links": "#4338ca",
  "Other": "#9ca3af",
};
export const LIBRARY_STATS = {
  totalAuthors: 112,
  totalBooks: 178,
  categories: 9,
};
export const AUTHORS: AuthorEntry[] = [
  {
    name: "Aaron Ross and Jason Lemkin - sales strategy, B2B growth, and predictable revenue generation",
    id: "1Hzusx2DCXs2EaxMTk2K8t_gJMLM0kuA_",
    category: "Sales & Negotiation",
    books: [
    { name: "From Impossible to Inevitable - Aaron Ross & Jason Lemkin", id: "1WDz-1Qrhhtpsc8x2u3JUhbE3demLbjI8", contentTypes: {"PDF": 1, "Transcript": 7, "Notes": 8, "Binder": 2} },
    { name: "Predictable Revenue - Aaron Ross & Marylou Tyler", id: "1qyLwgET3NNyyg5_KCYodRyQfPCXjpRSH", contentTypes: {"Transcript": 7, "Binder": 1, "Knowledge Base": 4} }
  ]
  },
  {
    name: "Adam Grant - organizational psychology, workplace culture, and leadership",
    id: "1GRgulHWf8aZ0fXmA-FaKrQgVOUPKo9BJ",
    category: "Behavioral Science & Psychology",
    books: [
    { name: "Hidden Potential - Adam Grant", id: "1bfktwQlybWaX9XoOFOaNDBavvY9Se112", contentTypes: {"Transcript": 5, "Binder": 1, "PDF": 1, "temp": 1, "Complete Book in PDF": 1} },
    { name: "Hidden Potential", id: "1-hqofS1N2zt9EInulrUrW6Yi5k_jhYtx", contentTypes: {"Transcript": 5, "PDF": 1, "Binder": 1} }
  ]
  },
  {
    name: "Al Ries - Positioning strategy and brand differentiation",
    id: "17CC2rbrC989kw3gT5Vr6ZSYpouh86J1I",
    category: "Strategy & Economics",
    books: [
    { name: "Positioning", id: "1k6Z6cE_0HgCOAbQ2HRZ91ep3bdpuyU64", contentTypes: {"PDF": 1} }
  ]
  },
  {
    name: "Alan Dib - Lean marketing and growth strategy",
    id: "1Pw11T23l3FN1aVuXiha2U00BNbcsxeRh",
    category: "Strategy & Economics",
    books: [
    { name: "Lean Marketing - Allan Dib", id: "1aRk1ptZ9wr8YPaxjKG7yRLDEGtED-ggh", contentTypes: {"Transcript": 6} }
  ]
  },
  {
    name: "Albert Rutherford - Statistics",
    id: "1mzCBBkDXOXFowpVd2qq3xzvOgj7uIigM",
    category: "Self-Help & Productivity",
    books: [
    { name: "Statistics for the Rest of Us", id: "1B05zQaNyxjH_YvUhntx2phpnXjetJ9jh", contentTypes: {"PDF": 1} }
  ]
  },
  {
    name: "Alex Hormozi - Entrepreneurship, scaling, and monetization strategies",
    id: "1MfBfT8aTOkMpwRjMfoB_CAtjz4nDEYWo",
    category: "Business & Entrepreneurship",
    books: [
    { name: "100M Leads - Alex Hormozi", id: "17Msqkw27nKwVs1IgVvVN3-RmMT9SrESH", contentTypes: {"Transcript": 2, "PDF": 2} }
  ]
  },
  {
    name: "Alison Wood Brooks - Behavioral science and conversational mastery",
    id: "1esRx92MFt9Oyv6Gq-sqIlSfOhN4iC2Xd",
    category: "Behavioral Science & Psychology",
    books: [
    { name: "Talk", id: "1rw3wjRaCCmGsJHoYbAcnqyGRBU2F6eoZ", contentTypes: {"PDF": 1} },
    { name: "bk_rand_011854", id: "1_WT-lQd9dhG0VZ7BRscvxweODGDQrGRd", contentTypes: {"PDF": 1} }
  ]
  },
  {
    name: "Andrew Ross Sorkin",
    id: "1GLqVzwePzwxkvO4oTnKJIdPudOQOsP3K",
    category: "Business & Entrepreneurship",
    books: [
    { name: "1929", id: "1ECWAyQymVgpcZcpGtVR-qjt8s6Ry-2mz", contentTypes: {} }
  ]
  },
  {
    name: "Annie Duke - decision-making science, behavioral psychology, and strategic thinking",
    id: "1F3gr8NfQ1Y7RmwyEbPZoAcP06MVgM5mk",
    category: "Behavioral Science & Psychology",
    books: [
    { name: "Quit - Annie Duke", id: "1AKc4rICLCTwuBRbOfgoOuf6TQWSFiMwY", contentTypes: {"temp": 1, "Transcript": 2, "PDF": 1} },
    { name: "How to Decide", id: "1Vo36hxR7BOHFXeGPuUvF1_jkh9awqfTF", contentTypes: {"Other": 1} },
    { name: "Quit", id: "1r4J2cWIjxgnhYlAvM4x4Fn1Vo-FSyzlP", contentTypes: {"Transcript": 2} }
  ]
  },
  {
    name: "April Dunford - B2B product positioning and messaging",
    id: "1w0Kc__ysd3Qj6UI5D-3slXjvxMb_LeLT",
    category: "Sales & Negotiation",
    books: [
    { name: "Obviously Awesome", id: "183iMIzLbozSglxK6A8efdB4DDu4rJt_O", contentTypes: {"PDF": 1} },
    { name: "Sales Pitch - April Dunford", id: "1g7hCAUgwSSrwlIHOhItrRXet-hSURfLB", contentTypes: {"Transcript": 3, "PDF": 1} },
    { name: "Sales Pitch", id: "1_6-dpu6qlx_yDJuwp4tlQFhBfCadw375", contentTypes: {"Transcript": 3} }
  ]
  },
  {
    name: "Arianna Huffington - Self Improvement and Business",
    id: "1CP9beF_u0cY_9XSj8v-gl1Ewj9ILj4uQ",
    category: "Business & Entrepreneurship",
    books: [
    { name: "Thrive", id: "1fluwT2MyKYTCyyNKw6C5-oAJQEnLIwAo", contentTypes: {"PDF": 1} }
  ]
  },
  {
    name: "Ash Maurya - Startups",
    id: "1EtdBu8f1PJqW4jeSp62XiSpXKpGEGGAq",
    category: "Business & Entrepreneurship",
    books: [
    { name: "Scaling Lean - Ash Maurya", id: "1jKF4E5T_OD4aAWarWwef46QakZaljzed", contentTypes: {"Transcript": 2, "PDF": 2, "Binder": 1} },
    { name: "Scaling Lean", id: "1UfyFAoy44N5GOhrWove_MlEXyGpG17mi", contentTypes: {"Transcript": 2, "Binder": 1, "PDF": 1} },
    { name: "Running Lean", id: "1fdZgJfUUwz8_7cPtAggr7KHo1TM0YUnD", contentTypes: {"PDF": 3, "Transcript": 5, "Running Lean (3rd Edition)_ Iterate from Plan A to a Plan That Works": 1, "Binder": 1} }
  ]
  },
  {
    name: "Ashvin Vaidyanathan and Ruben Rabago - Customer success",
    id: "1uItjZsccrYZeNTP3-THhJhVx6GsrHQXg",
    category: "Business & Entrepreneurship",
    books: [
    { name: "The Customer Success Professional's Handbook - Ashvin Vaidyanathan & Ruben Rabago", id: "1v6qQfLinISHr7tDPsFOuVHJ1aRZL69Vq", contentTypes: {"Transcript": 2, "Additional DOC": 1} }
  ]
  },
  {
    name: "Ashvin Vaidyanathan & Ruben Rabago - Customer success and growth enablement",
    id: "1vAt_DoD6vK3a11MiagI-sYNK-SqHeKHG",
    category: "Business & Entrepreneurship",
    books: [
    { name: "Running Lean - Ash Maurya", id: "1ez4A8ic2gbOYyG7wg6oK--jHSSRmjJ3V", contentTypes: {"PDF": 1, "Binder": 1, "Transcript": 5, "Running Lean (3rd Edition)_ Iterate from Plan A to a Plan That Works": 1, "temp": 1} },
    { name: "The Customer Success Professional Handbook", id: "1SymnayKM0HtfSwcEKpNGdetFXz_02XqM", contentTypes: {"Transcript": 2, "Binder": 1, "PDF": 1} }
  ]
  },
  {
    name: "Ben Horowitz - Startup leadership and business culture",
    id: "1T8Ro-tjEQdHqgz19bbSE9KNQtyBgADdC",
    category: "Leadership & Management",
    books: [
    { name: "What You Do Is Who You Are", id: "1Gf1ewZ7mQjTPfqdaTDBpt53rmZ84VIse", contentTypes: {"PDF": 1} }
  ]
  },
  {
    name: "Benjamin Franklin - renaissance man",
    id: "1hDf2wEAiB1QInn3i9YKT6rHtm2soy5To",
    category: "History & Biography",
    books: [
    { name: "The Autobiography of Benjamin Franklin", id: "1hVZUPmVcKov4v32ga-Nfz2S-1Ve2k7p_", contentTypes: {"PDF": 1} }
  ]
  },
  {
    name: "Cal Newport - Deep work and sustainable productivity",
    id: "1qFB0DQo1h1Kq_ULEcmHnkseWutNt_KNS",
    category: "Self-Help & Productivity",
    books: [
    { name: "Slow Productivity - Cal Newport", id: "1VEW6EHlLzAmh0D4ndQtMt5iJSTvm030a", contentTypes: {"Additional DOC": 1, "Transcript": 2} },
    { name: "Slow Productivity The Lost Art of Accomplishment Without Burnout", id: "1IjHgqB_IP3-NKCp0l5MoazQOuqaaORxT", contentTypes: {"Transcript": 2, "Additional DOC": 1} }
  ]
  },
  {
    name: "Charles Duhigg - Habits, Productivity & Communication",
    id: "1dple5WeRy_XVTF4SjFwDcMp1Zu-pgec3",
    category: "Self-Help & Productivity",
    books: [
    { name: "Charles Duhigg", id: "1Ck-hu-uKHF9uuMUeIZeI4QW9KkDoljIu", contentTypes: {"Images": 1} },
    { name: "The Power of Habit", id: "1NnP0Cl67rohkjnj2UfecCoNMnLWT3iNf", contentTypes: {"Other": 1} },
    { name: "Supercommunicators", id: "1aCGhXBQpeUFVaI6nWKPuNbKFhCDKoT1n", contentTypes: {"Transcript": 2, "PDF": 5, "Binder": 1, "PDF Extra 2": 3} }
  ]
  },
  {
    name: "Charles Duhigg - Habits, productivity, and willpower",
    id: "1AbdMEQx-2a9IMYuMKN-uQE_x40qqXe5P",
    category: "Behavioral Science & Psychology",
    books: [
    { name: "The Power of Habit - Charles Duhigg", id: "1Kkzy_9Zw8MffVAZieI-e9F_hBOsj-aUl", contentTypes: {"Transcript": 4, "PDF Extras": 3, "Binder": 1} },
    { name: "Supercommunicators - Charles Duhigg", id: "1zmejGNVROHI2JL-u6Lu3M4DZljiUW2Ye", contentTypes: {"DOC": 2, "Transcript": 2, "PDF": 4, "Binder": 1, "PDF Extra 2": 3} }
  ]
  },
  {
    name: "Chris Dixon - Tech and Venture Capital",
    id: "1AvDT5CUCTFEw19golALjn_zxRJUpgMGd",
    category: "Technology & Futurism",
    books: [
    { name: "Read Write Own", id: "1uix8b1Ua373i47VTdzsYaTrOo-gG5Dcj", contentTypes: {"PDF": 1} }
  ]
  },
  {
    name: "Chris Voss - Hostage negotiation and business persuasion",
    id: "13qEfZ9-56R2-iG3RxjFKshbK5aJRd8NH",
    category: "Sales & Negotiation",
    books: [
    { name: "Never Split the Difference - Chris Voss & Tahl Raz", id: "1G3CwjcOXweEw5nseCgurMAcpjU8KYips", contentTypes: {"Transcript": 2, "Binder": 1, "Additional DOC": 2, "temp": 1, "Knowledge Base Files": 1} },
    { name: "Never Split the Difference by Chris Voss", id: "18WmHI23KP-LkA5-ZFIklxDUUdFT_K_cb", contentTypes: {"PDF": 1, "Transcript": 2, "Binder": 1, "Additional DOC": 2, "Knowledge Base Files": 1} }
  ]
  },
  {
    name: "Colin Bryar & Bill Carr - Working Backwards (Amazon)",
    id: "1Su4M5QfDxXOnmh2DETBBjFrE3Uz02MG7",
    category: "Business & Entrepreneurship",
    books: [
    { name: "Working Backwards", id: "1bHXpoAU0e3yjzbJZKKMfG5-IMg5xccml", contentTypes: {"PDF": 1} }
  ]
  },
  {
    name: "Dale Carnegie - Personal influence and relationship mastery",
    id: "1W70QRN1QpsLgdIq1vTTLLz9m_6XOjPhy",
    category: "Behavioral Science & Psychology",
    books: [
    { name: "How to Win Friends and Influence People - Dale Carnegie", id: "1VQZibcd-IVbEJB3nfPrxHsjsr0WTjzPh", contentTypes: {"PDF": 1} },
    { name: "Book PDF", id: "12_SS0oighj-Lf4tiX4hHdw-3IE-GXfMY", contentTypes: {"Other": 1} }
  ]
  },
  {
    name: "Dan Harris - Mindfulness advocacy and practical meditation",
    id: "1XNMVAmqlJWlOVe-luTWKMVNS-pgx30Nh",
    category: "Self-Help & Productivity",
    books: [
    { name: "10% Happier 10th Anniversary", id: "1iYQelUi4ztDlOMWSmdfnVFwzwchcpi4Q", contentTypes: {"PDF": 1} }
  ]
  },
  {
    name: "Daniel J. Siegel - Interpersonal neurobiology and mindful parenting",
    id: "1uOqCpLF2yZPGdIQ5iewGz90jpdoGzfb_",
    category: "Behavioral Science & Psychology",
    books: [
    { name: "The Whole-Brain Child - Daniel J. Siegel & Tina Payne Bryson", id: "1JNzGaF1oM1t-Gi2srg8RAoYhGlkhqfLG", contentTypes: {"Transcript": 2} },
    { name: "Thinking, Fast and Slow - Daniel Kahneman", id: "1SdHKKUrZDyEbJh6zQfsKpUHjQZvTzNZp", contentTypes: {"PDF": 1} },
    { name: "The Neurology of We", id: "18koEbulUch7Z3maNGidOZEcm6FHpXP0z", contentTypes: {"Transcript": 2} }
  ]
  },
  {
    name: "Daniel Kahneman - behavioral economics, cognitive psychology, and decision-making science",
    id: "14T3V1bfyjPY1VlUmmZECCxo-J66e_s36",
    category: "Behavioral Science & Psychology",
    books: [
    { name: "Thinking, Fast and Slow", id: "1TQt97XiJpyx-oFE_q6VihF8WXa4rrBN1", contentTypes: {"PDF": 1} }
  ]
  },
  {
    name: "Daniel Larose - Statistics",
    id: "1KPafpMXg48IdUsVT4sxoSTdy0tLrAIEk",
    category: "Technology & Futurism",
    books: [
    { name: "Discovering Statistics", id: "1cQ-N4tV1tN3A2dmBUjqURI5iTkThhqYS", contentTypes: {"PDF": 2} }
  ]
  },
  {
    name: "Darrell Huff - Statistical skepticism and data literacy",
    id: "1yoSNT17sJBphreJQzeOEP8lDrvIFZPhn",
    category: "Self-Help & Productivity",
    books: [
    { name: "How to Lie with Statistics", id: "1U0JnMopPSQls50kV4zDMU7Sdl0odvFEb", contentTypes: {"PDF": 1} }
  ]
  },
  {
    name: "David Brooks - political commentary, social psychology, and cultural analysis - communication",
    id: "1tU-3hf3xolgMMjDOUaDFBwZr0a-eooU9",
    category: "Behavioral Science & Psychology",
    books: [
    { name: "David Brooks", id: "1lbZ-qgwAfJBZ_7E8HyPYrf4u9xLxlgAH", contentTypes: {"Images": 1} },
    { name: "The Second Mountain - David Brooks", id: "1iKh5TRB2tnp_DWzSjVK7t0QsITlK9aSb", contentTypes: {"PDF": 1, "Transcript": 4, "Binder": 1} },
    { name: "The Road to Character - David Brooks", id: "168xjl9eJ6rF6cD4pubQIQB3Jr9mF4a3W", contentTypes: {"Transcript": 3, "temp": 1, "PDF": 1} },
    { name: "How to Know a Person - David Brooks", id: "1LmkKiT9Q9hrDFuJPIB2EE-Aduek6THZt", contentTypes: {"Video": 1, "Interview": 4, "Transcript": 22, "Binder": 1, "PDF": 1, "Interview Transcript": 4} },
    { name: "The Social Animal", id: "1FPgE0bA5yiBIIyURg6gYt7sneCtbHY6y", contentTypes: {"PDF": 1} },
    { name: "The Road to Character", id: "1wyhPih8syeaL2rqPMjF8KbWtPw492L6K", contentTypes: {"Transcript": 3} },
    { name: "How to Know a Person", id: "1VxZ8MwpD4CyulHVLhlP74j2SzNhmrC5p", contentTypes: {"Transcript": 22, "Binder": 1} }
  ]
  },
  {
    name: "David N. Schwartz - Nuclear history and scientific biography",
    id: "1BYdBzEJtfZ0uGx2DYvy4raPucXtJV9o9",
    category: "History & Biography",
    books: [
    { name: "The Last Man Who Knew Everything - David N. Schwartz", id: "1q2loPoDX7-m-iYdLdpMCPF2tqd97XjZw", contentTypes: {"DOC": 4, "Binder": 1, "PDF": 2, "Transcript": 2} },
    { name: "The Last Man Who Knew Everything", id: "196eQguirea8hamxgeaiOJP4MXT-rFZdG", contentTypes: {"DOC": 4, "Transcript": 2, "Binder": 1, "PDF": 1} }
  ]
  },
  {
    name: "David Nihill - Public speaking and humor techniques",
    id: "1OE6s4wMVabANToPtX0XOrb4lawk5N29j",
    category: "Communication & Storytelling",
    books: [
    { name: "Do You Talk Funny? - David Nihill", id: "1O-5P5n6I75o8RaGeOTPewtk6chw46sS2", contentTypes: {"Transcript": 2} },
    { name: "Do You Talk Funny", id: "1MENPJpka2e94jrVnNtgCtGIueZoVKCCn", contentTypes: {"Transcript": 2} }
  ]
  },
  {
    name: "Emma Leigh Weber - Empathic communication and active listening",
    id: "1TEJqldgiRikqhaxAWcxVOPZhBigB5yfj",
    category: "Communication & Storytelling",
    books: [
    { name: "Active Listening [3-in-1]", id: "1W6_9lq8lZjxgO5cuXen6XOHLJpC7cbLU", contentTypes: {"PDF": 1} }
  ]
  },
  {
    name: "Eric Ries - Startups",
    id: "1pcFfqrCfUiJNS-RVnrVN0OU4IkqAal3q",
    category: "Business & Entrepreneurship",
    books: [
    { name: "The Lean Startup - Eric Ries", id: "1eQpIYY_SFNBTLou48nSSxcvQsgrW3III", contentTypes: {"PDF Version": 2, "PDF": 1} },
    { name: "The Leader's Guide - Eric Ries", id: "1cWvaeSPyc1Wrmce3nJW0UJy4rTdSkYUJ", contentTypes: {"Transcript": 2, "PDF": 1, "Binder": 1} },
    { name: "The Leaders Guide", id: "1ljS-gwcrkU4Mxj4OsM65_S-MYS2AlrDM", contentTypes: {"Transcript": 2, "Binder": 1, "PDF": 1} },
    { name: "The Lean Startup", id: "1WF85y-8R0XzmBVlr3kvkKQrq34WRwiM5", contentTypes: {"PDF Version": 2} },
    { name: "The Startup Way", id: "1qANI-oOCLDvGYCduNU9r89rK8sp3_HsR", contentTypes: {"Other": 1} }
  ]
  },
  {
    name: "Eric Topol - Longevity and precision medicine",
    id: "1hlw_MjOPB4iks7unhlbFpb4PPK3_NjcS",
    category: "Technology & Futurism",
    books: [
    { name: "Super Agers - Eric Topol", id: "1SM-XBvJjk_vkvXoDpySnsesyQpUwDPtY", contentTypes: {"PDF": 2, "DOC": 1, "Supplemental": 3, "Binder": 1} }
  ]
  },
  {
    name: "Eric Topol - Digital health, AI, and longevity",
    id: "1cymfhwhwkK_uHBa8LRKjuUZJ1qDcfoXg",
    category: "Technology & Futurism",
    books: []
  },
  {
    name: "Esther Perel - Modern Relationships & Erotic Intelligence",
    id: "1UjKUOoXTznHJQ3k8xoQqFbcTMhSM8BQs",
    category: "Behavioral Science & Psychology",
    books: [
    { name: "Mating in Captivity", id: "1CyOd2waOgUiIlqvDksUBcHDcmtxwMlfa", contentTypes: {"PDF": 1} },
    { name: "The State of Affairs", id: "1auK9vf48-4R4q3Fngf2az-U_qwzgdJ73", contentTypes: {"PDF": 1} }
  ]
  },
  {
    name: "Ezra Klein - Political polarization and institutional reform",
    id: "1io5fu6D0KHCuTnI3fgvhEk_qsraLfIqW",
    category: "Technology & Futurism",
    books: [
    { name: "Abundance", id: "1bAoVR0uH2rA7KoZ8otOEsJnMZPbGETSf", contentTypes: {"PDF": 1} }
  ]
  },
  {
    name: "Frances Frei & Anne Morriss - Leadership transformation and organizational trust",
    id: "1d4q1cnj_sSsLAFL41FRSynLnnSgnW-3Y",
    category: "Leadership & Management",
    books: [
    { name: "Move Fast and Fix Things", id: "1vh2kC9-FvtiD-z9ELteFx_ZeVkpgABta", contentTypes: {"PDF": 1} }
  ]
  },
  {
    name: "Fred Dust - Human-centered design and dialogue facilitation",
    id: "1sO8iZa4szVNr-c7DiPtIFExuFG1TeAx8",
    category: "Communication & Storytelling",
    books: [
    { name: "Making Conversation - Fred Dust", id: "1lozeRuRw1Sdi8sz3HmYVHXxbL9R3C-wp", contentTypes: {"Transcript": 2} },
    { name: "Making Conversation", id: "1oMhOVvnN8Oop81V4V_KEB5OJZdJ1q4vb", contentTypes: {"Transcript": 2} }
  ]
  },
  {
    name: "Geoffrey Moore - High-tech market adoption strategist",
    id: "1OwS1shraqtNm1A9PR29AypvHEsNO1ouK",
    category: "Technology & Futurism",
    books: [
    { name: "Crossing the Chasm, 3rd Edition", id: "1Dk6FbYX9UfMfiZCCDSQ27NzhnXfOVC9M", contentTypes: {"PDF": 1} }
  ]
  },
  {
    name: "George Friedman - Geopolitical Forecasting & Strategy",
    id: "1qJRoYMBI0ZaDfnWqIiTenB94ZsAGA4Eh",
    category: "Strategy & Economics",
    books: [
    { name: "The Next 100 Years - George Friedman", id: "1xOi_k5ZsTKeA80YVyAS7Q2pkz8ptRUil", contentTypes: {"PDF": 2} }
  ]
  },
  {
    name: "Gino Wickman - entrepreneurship, business leadership, and organizational development",
    id: "1CBVw6FMN8mClzYIwt5snoxhbtTCY3L16",
    category: "Business & Entrepreneurship",
    books: [
    { name: "Traction", id: "1L3iF7E0qpnJbGnomn9XtnWMV-JSJ0RMy", contentTypes: {"PDF": 1} }
  ]
  },
  {
    name: "Hamilton Helmer - Business Strategy",
    id: "1jCZV7ddwBgKuVX5X1czGonu1mGOt7Mdk",
    category: "Strategy & Economics",
    books: [
    { name: "7 Powers_ The Foundations of Business Strategy", id: "1dZrAy0OCOUIfD-YV111zeZgLra3uBjRb", contentTypes: {"PDF": 1} }
  ]
  },
  {
    name: "Hans Peter Bech - Channel Sales - business development, B2B marketing, and international sales strategy",
    id: "1JDloGddbi52nhMXHTVZ8JpublXh3rNHy",
    category: "Sales & Negotiation",
    books: [
    { name: "Building Successful Partner Channels", id: "1IKdOaQirZRfnZwy7I1Uks6-XirkNpn-r", contentTypes: {"PDF": 1} },
    { name: "Going Global on a Shoestring", id: "1eXmqZiENXh-JYS8YnIkttS8aVOhticZ4", contentTypes: {"PDF": 1} }
  ]
  },
  {
    name: "Henry Louis Gates Jr - African American History and literature",
    id: "1VzsnTj1Gv7C_YwrwWLxuxHGumYDcRZkb",
    category: "History & Biography",
    books: [
    { name: "What You Do Is Who You Are", id: "1BQQ2VtK8HTHqnbR3EPOuRHIxuifp1fmB", contentTypes: {"PDF": 1} }
  ]
  },
  {
    name: "Houston Howard - Transmedia storytelling and franchise strategy",
    id: "1k0YR0DU5SBcOgCUuzreQY2c0E8ZlkBnA",
    category: "Communication & Storytelling",
    books: []
  },
  {
    name: "Jack Stack and Bo Burlingham - Open-book management and employee ownership",
    id: "1z-7rqUvZru3MI1-ygrqrRGMS4h1qYugT",
    category: "Business & Entrepreneurship",
    books: [
    { name: "The Great Game of Business - Jack Stack & Bo Burlingham", id: "19WqPA4b6zA_s4Zbq6YH4Pw5LasiHhWTJ", contentTypes: {"Transcript": 4} },
    { name: "Great Game Business", id: "1BLQrYn9EGcbk7GdGkbEr7NEtrk3wvGDX", contentTypes: {"Transcript": 4} }
  ]
  },
  {
    name: "James Clear - Self Improvement",
    id: "16ZGsFh5pZatqZa5zdC6UyjJqochApNa-",
    category: "Self-Help & Productivity",
    books: [
    { name: "Atomic Habits", id: "1uPppuJ1DIhx6xFDEVjQYy0eD63msGvYp", contentTypes: {"PDF": 1} }
  ]
  },
  {
    name: "James Surowiecki - economics, business journalism, and behavioral finance",
    id: "17Yky4pDjjoQvhVpExunbQwV214TtLQV3",
    category: "Behavioral Science & Psychology",
    books: [
    { name: "The Wisdom of Crowds", id: "12PncZ5EdK7gcumzFQGZD-GBy8apt_GIV", contentTypes: {"PDF": 2} }
  ]
  },
  {
    name: "Jason Harris - branding, advertising, and business leadership",
    id: "1vWZswyXsDP4qQZFo6DttViRb3rmDscNg",
    category: "Communication & Storytelling",
    books: [
    { name: "The Soulful Art of Persuasion", id: "19nd9ARGes5Z_H-dIFRtavgtefMg5pZbu", contentTypes: {"PDF": 1} }
  ]
  },
  {
    name: "Jeb Blount - Sales acceleration and prospecting mastery",
    id: "1klsK3ynbxq6mtM0JscZgFx6ir9YXaGiN",
    category: "Sales & Negotiation",
    books: [
    { name: "Objections", id: "1B1TLe8j1TaJNau5L2vBa6X6MdwjtVbHZ", contentTypes: {"PDF": 1} },
    { name: "The AI Edge", id: "1fZ2bmxyrj1PmJuQgj8cpZ9V1pkijejtw", contentTypes: {"PDF": 1} },
    { name: "Fanatical Prospecting - Jeb Blount", id: "1VxwSHR2z2dV9eQ8zxkCTwW4nbK1TkUtP", contentTypes: {"PDF": 2, "Transcript": 6, "Cold Calling and ebooks": 20, "Additional DOC": 1, "Binder": 1} },
    { name: "The Sales EQ", id: "1LIVcpC_TZr5rq7YC8E2kAFs1okZXANar", contentTypes: {"Other": 1} }
  ]
  },
  {
    name: "Jeff Shannon - Meeting facilitation and leadership development",
    id: "1xE1A1yKG2CyWo2TIpkNmh1VWGQ2QuXsP",
    category: "Leadership & Management",
    books: [
    { name: "Lead Engaging Meetings - Jeff Shannon", id: "13q6csVhoaK3_t3xw8vDicrEGFeOyJqYQ", contentTypes: {"Transcript": 3} },
    { name: "Leading Engaging Meetings", id: "1kwYxOkaQVNdVcTLNMUM1fr6nJ9Mu3SGP", contentTypes: {"Transcript": 3} }
  ]
  },
  {
    name: "Jefferson Fisher - Conflict resolution and confident communication",
    id: "1aL3qSo-dq37o5tHssXqKplsDUKiM_4VK",
    category: "Leadership & Management",
    books: [
    { name: "The Next Conversation", id: "1d6G92kvciP76VfvzPPSG2E9dCvhCVRWD", contentTypes: {"PDF": 1} },
    { name: "Jefferson-Fisher-Open-Graph", id: "1jqq5leYMkm-7YBsgUCws9MwtfVmkBy1R", contentTypes: {"Images": 1} }
  ]
  },
  {
    name: "Jim Camp - Decision-based negotiation and assertive strategy",
    id: "1wSB35OEZh9PGeYhNy4OzeGYpUjQUru4a",
    category: "Sales & Negotiation",
    books: [
    { name: "Start with No - Jim Camp", id: "1_94vdT-9WrMMwoH4NCms7MjJJUrd8jNG", contentTypes: {"Transcript": 2} },
    { name: "No: The Only Negotiating System You Need - Jim Camp", id: "1PNp26PHGsdlVzUc4B9ssfA57_GcDX1ZP", contentTypes: {"Transcript": 3} },
    { name: "No - The Only Negotiating System You Need by Jim Camp", id: "1YOrCxHEXDWwzk3K6WqA7dQ5OhK6FsvjS", contentTypes: {"Transcript": 3} },
    { name: "Start with a No", id: "1gm3vZrfG13OVoBXAgjd1B2fjLem9jC9J", contentTypes: {"PDF": 1} }
  ]
  },
  {
    name: "Jim Collins - Business leadership and organizational excellence",
    id: "1-lUkRsoR7Eoksy9_ZcvAL6zxYe3eaxm7",
    category: "Strategy & Economics",
    books: [
    { name: "Good to Great (Summary) - Jim Collins", id: "1ft599AlLo1DQaoS4JIr-srbVgQSdvam9", contentTypes: {"Transcript": 2, "Additional DOC": 1} },
    { name: "Summary of Jim Collins Good to Great Key Takeaways and Analysis", id: "1v7Fvuz6mcF0pETCUpr3Yylh020rvOJLv", contentTypes: {"Transcript": 2, "Additional DOC": 1} }
  ]
  },
  {
    name: "John Doerr - Venture capital, OKRs, climate action",
    id: "1fQ2HkTIrqGKmsTq6sH2W4_ooa1jFnq2a",
    category: "Strategy & Economics",
    books: [
    { name: "Speed & Scale", id: "1mccV5TcMBNd4vQBrY56aBb19rLU-SiSF", contentTypes: {"PDF": 1} }
  ]
  },
  {
    name: "John Mullins - Startups",
    id: "1RW483-ffOYoNFmeDVYWRUtrjtd6fJjlC",
    category: "Business & Entrepreneurship",
    books: [
    { name: "New Business Road Test, The", id: "1ACy7potp148BHGMITFyJ_5ZrNPdMOc-0", contentTypes: {"PDF": 1} }
  ]
  },
  {
    name: "Karen Blumenthal - Nonfiction & Biography",
    id: "1ak3COyiixfC3T-tsyFOrEFWC5O0UnhUN",
    category: "History & Biography",
    books: [
    { name: "Steve Jobs_ The Man Who Thought Different_ A Biography", id: "1RV71m_SLL3BBCTZU62M0uaPJdaMx2qqh", contentTypes: {"PDF": 1} }
  ]
  },
  {
    name: "Karen Eber - Storytelling, Leadership, and Organizational Culture",
    id: "1-rD6drFo7E83-YNjElweNkG6ZyxaVcWc",
    category: "Communication & Storytelling",
    books: [
    { name: "The Perfect Story - Karen Eber", id: "1aijNrOPzCPlDgrFAJC5u07Q8fwQeBFKT", contentTypes: {"PDF": 1} },
    { name: "Book PDF", id: "1fModm50AVh2R-cKYEB1A2DKAU8cy_pLg", contentTypes: {"Other": 1} }
  ]
  },
  {
    name: "Kelly Leonard and Tom Yorton - Improv and business communication",
    id: "1qgMsRsTN2UfdAMXFJ5Qx-LJTrEuy9ayN",
    category: "Communication & Storytelling",
    books: [
    { name: "Yes, And - Kelly Leonard & Tom Yorton", id: "1fB1i5bKbwTWJAT1HiR5h8TKTK0zAuFrv", contentTypes: {"Transcript": 4} }
  ]
  },
  {
    name: "Kelly Leonard - Educational architecture and learning innovation",
    id: "1jJKds7l-QMpJzuLCvgEmBmgC8CDQASuC",
    category: "Leadership & Management",
    books: [
    { name: "Yes, And", id: "1EM5j9FcD85BEZQ8r8gxXWndtpipsTptU", contentTypes: {"PDF": 1} }
  ]
  },
  {
    name: "Kim Scott - Leadership and Communication",
    id: "1ZcyL8daMuxPQU9PePKZd3LmQG6JQQ2RT",
    category: "Leadership & Management",
    books: [
    { name: "Radical Candor - Kim Scott", id: "1B9WVoaUqMN4U_NGqAeGohfxUj46nQslR", contentTypes: {"Transcript": 2, "temp": 1, "PDF": 1} },
    { name: "Radical Candor", id: "1vIGB3aD_4L8h8LLYpm4ZTU3wpLnUFxFy", contentTypes: {"Transcript": 2} }
  ]
  },
  {
    name: "Lawrence Weinstein - communication, rhetoric, and writing instructio",
    id: "1kDFPKlnGbuheSe_yhSadceXj50UMebfn",
    category: "Communication & Storytelling",
    books: [
    { name: "Guesstimation 2.0", id: "15m_lC8PN78TCdkTlbDiU86D8X1h-nPk4", contentTypes: {"PDF": 1} }
  ]
  },
  {
    name: "Leander Kahney - Apple-focused technology culture biographer",
    id: "119TxtPOVaxfB-TntB8SR0NNyWPdVFQ-J",
    category: "History & Biography",
    books: [
    { name: "Inside Steve", id: "17AK4qYmfpdGBvbwIWtFQxNTHkf9j800t", contentTypes: {"PDF": 1} }
  ]
  },
  {
    name: "Leil Lowndes - Interpersonal communication and social confidence",
    id: "1TK5VwtrQS-nCVV4O9IFi6NOdkE0ytsb6",
    category: "Communication & Storytelling",
    books: [
    { name: "How to Talk to Anyone - Leil Lowndes", id: "1xoaF79V51AflPz_vug2J91QHypVLwFLu", contentTypes: {"Transcript": 2} },
    { name: "How to Talk to Anyone", id: "1A4quNDJLjLc1Is8TZMyBjoDDRoOBt4cP", contentTypes: {"Transcript": 2} }
  ]
  },
  {
    name: "Malcolm Gladwell - pop psychology, sociology, and cultural commentary",
    id: "1inZOAkcSs6wTCfFOjbOI-eSu4hCMP36Q",
    category: "Behavioral Science & Psychology",
    books: [
    { name: "The Tipping Point", id: "1TWPNOt1NR8m165e2ueHlgK_kq7dg_tLY", contentTypes: {"PDF": 1} },
    { name: "Revenge of the Tipping Point", id: "1eyaVtXvuKu8yR_qGg0DJsaj2gfIM7eRT", contentTypes: {"PDF": 1} }
  ]
  },
  {
    name: "Marcus Aurelius - Philosopher",
    id: "1CosWk7g4gkeGVpa0a_4wtZQNiZL6SAH5",
    category: "Self-Help & Productivity",
    books: [
    { name: "Meditations", id: "1aQiJCiqSIZ56ZlUgprzCFNZ4RBXdID1Q", contentTypes: {"PDF": 1} }
  ]
  },
  {
    name: "Martin Lindstrom - Branding psychology and consumer behavior expert",
    id: "1u1nzujnjJlPyNTxNxxdrHdZYv2RoaAdJ",
    category: "Behavioral Science & Psychology",
    books: [
    { name: "Small Data", id: "1XshuP57SscP1r7D4MV6g56vU8PwIE9cB", contentTypes: {"PDF": 1} },
    { name: "Small Data_ The Tiny Clues That Uncover Huge Trends", id: "1qLx0VK2E09CwWZZ8Yt4ZsBaTOAB0CEdp", contentTypes: {"PDF": 1} }
  ]
  },
  {
    name: "Matthew Dixon - Sales strategy and customer psychology experts",
    id: "1kymAGzJa-VtqqmQbX-meBeg2fF7lDTZb",
    category: "Sales & Negotiation",
    books: [
    { name: "The Jolt Effect", id: "1pYTYd8QeBxKyUugXCE8JbGzYTC28-95U", contentTypes: {"Summaries PDF": 7, "Transcript": 2, "PDF": 6, "DOC": 1, "Binder PDF": 1, "temp": 1, "Summaries DOC": 8} },
    { name: "The Challenger Customer", id: "1YUnq2Y149o6YsFmSUCbKjIWsPs6Z1POe", contentTypes: {"Transcript": 2, "Additional DOC": 1, "PDF": 1} },
    { name: "Effortless Experience", id: "17YJ1Z17RLvbjG5Uj77SEWSoNcM7dflva", contentTypes: {"Transcript": 2} },
    { name: "The Challenger Sale", id: "1izD-UipjU_cTuH0GVyf2-4lPfnBfvegf", contentTypes: {"PDF": 1, "Transcript": 2} }
  ]
  },
  {
    name: "Matthew Dixon - Customer experience and loyalty",
    id: "1_OIP-AxMZcPopQaoYN3rF5mTyKOSGtMq",
    category: "Sales & Negotiation",
    books: [
    { name: "The Challenger Customer - Brent Adamson & Matthew Dixon", id: "1EkT7zRqbCEP0CKLL52-uCX13NXEAd6rV", contentTypes: {"Transcript": 2, "Additional DOC": 1} },
    { name: "The Effortless Experience - Matthew Dixon, Nick Toman & Rick DeLisi", id: "1H_U8c21YGkmOhTw80D4754i1e4vPr8Az", contentTypes: {} },
    { name: "The Challenger Sale - Matthew Dixon & Brent Adamson", id: "1XaVejPCfUDzAdRdW8uXsSxYu3iMXiFLs", contentTypes: {"Transcript": 2} },
    { name: "The JOLT Effect - Matthew Dixon & Ted McKenna", id: "1W6e5U6oL9nxj7QEDi2kS8r13rDv6EfvN", contentTypes: {"Transcript": 2, "Summaries PDF": 7, "PDF": 5, "DOC": 1, "Binder PDF": 1, "temp": 1, "Summaries DOC": 8} }
  ]
  },
  {
    name: "Mel Robbins - self-help and motivational author",
    id: "1i5pHYEtiKKAlIw62g_uSzW3BdHA6ybCN",
    category: "Self-Help & Productivity",
    books: [
    { name: "The Let Them Theory", id: "1I4H28e0Wc_3yNdGIklWAGeE6s8wT8Bye", contentTypes: {"PDF": 1} },
    { name: "The Let Them Theory - Mel Robbins", id: "1xYxXc_MXdNfoAFQPUrWVs7dqnD_TuA-Q", contentTypes: {"PDF": 1} }
  ]
  },
  {
    name: "Mike Smerkle - Entrepreneurial grit and startup mindset",
    id: "1PckhfxXIbGT_XGs_syvH6u_MK14u0K1V",
    category: "Business & Entrepreneurship",
    books: [
    { name: "Mr. Monkey and Me", id: "1BvSybrviXygDvkGbwC3VIoFZSWBMR0f2", contentTypes: {"PDF": 2} }
  ]
  },
  {
    name: "Morgan Housel - behavioral finance, personal development, and economic psychology",
    id: "1uTt_BW1OrVMI-BonW1G-h0gIZ8Q5dK4a",
    category: "Behavioral Science & Psychology",
    books: [
    { name: "The Psychology of Money", id: "14_d-zGN8dKJWFgJWAlG0jaU7JJrBpcYp", contentTypes: {"PDF": 1} },
    { name: "Same as Ever", id: "1ziU8Ws5jvnm1VL3kayUc20KdQUyEtHaL", contentTypes: {"PDF": 1} }
  ]
  },
  {
    name: "Nixaly Leonardo - Active listening and communication",
    id: "1SqZKjuu71vMjzIqz9zJhzR6q8D5lHUzH",
    category: "Self-Help & Productivity",
    books: [
    { name: "Active Listening Techniques - Nixaly Leonardo", id: "1nlr__TWeNrMVbuA0mbfsesg5HI0SlcVH", contentTypes: {"Binder": 1, "Transcript": 2, "PDF": 2} }
  ]
  },
  {
    name: "Nixaly Leonardo - Therapeutic communication and emotional intelligence",
    id: "11EqNTfRQMk6Js7uDOFIhrj0jcmPt-hp3",
    category: "Behavioral Science & Psychology",
    books: [
    { name: "Active Listening", id: "1SBf3Z2_btMMIh-z8so09ztd_N67X7g2W", contentTypes: {"Transcript": 2, "Binder": 1, "PDF": 2} }
  ]
  },
  {
    name: "Hans Peter Bech - B2B channel strategy and global expansion",
    id: "1ULKHXxQyoMUKRykEQBGJYEWSPcsH8pPl",
    category: "Sales & Negotiation",
    books: [
    { name: "Building Successful Partner Channels - Hans Peter Bech", id: "1mqClJDNBCZ6eQqEHk333mcaVlCUuBARI", contentTypes: {"PDF": 1, "DOC": 3, "Transcript": 2, "Binder": 1, "ChatGPT": 4, "Sana AI": 2} },
    { name: "Building Successful Partner Channels", id: "1vfomGdTBRVTcI8A0dr8R9RinM0C4Mvbo", contentTypes: {"ChatGPT": 4, "Transcript": 2, "Sana AI": 2, "Binder": 1} }
  ]
  },
  {
    name: "Peter Northhouse - leadership theory and organizational behavior",
    id: "1SIcpFKCpPthqLfq5ttCvguNC67Pkxe9y",
    category: "Leadership & Management",
    books: []
  },
  {
    name: "Philipp Dettmer - Science communication and visual learning",
    id: "1e56Yu2wB3IdUfYktd78T_si9RzdPsO9_",
    category: "Technology & Futurism",
    books: [
    { name: "Immune - Philipp Dettmer", id: "1qXrcdxlt1Onsp8DMQ5dynMbumanZZdYz", contentTypes: {"PDF": 1} }
  ]
  },
  {
    name: "Philipp Dettmer - Health",
    id: "1R_thAKQzh4g3a4K5rHtS5Ut1ep5kH46f",
    category: "Technology & Futurism",
    books: [
    { name: "Immune by Philip Dettmer", id: "1qdxgljH6umlLWz4OZy3_ECOnm9fsVhpu", contentTypes: {"PDF": 1} }
  ]
  },
  {
    name: "Ray Kurzweil - Futurism, AI, and human longevity",
    id: "10R1G4tc2m7dPIZ79rdcvgPG3ceAshmK8",
    category: "Technology & Futurism",
    books: [
    { name: "The Singularity Is Nearer", id: "18HIndvGU-uJf5nb2LoUYnG3CWP6hdluH", contentTypes: {"PDF": 2} }
  ]
  },
  {
    name: "Reid Hoffman - Tech Futurist & LinkedIn Co-Founder",
    id: "1JaUjYvubl89ofzVRR6jOXYrhxWZlWoju",
    category: "Technology & Futurism",
    books: [
    { name: "Superagency", id: "1RWH-0ZyI8cRQ1Zp2N3JOwMqWLsuqZk8F", contentTypes: {"PDF": 1} }
  ]
  },
  {
    name: "Rhea Orion - Consensual nonmonogamy and relationship therapy",
    id: "1TuZEuNGDyuiXe9BXx3IWhJ0R3EfJHoep",
    category: "Behavioral Science & Psychology",
    books: [
    { name: "A Therapist\u2019s Guide to Consensual Nonmonogamy", id: "1WSlgHbrY3lGehPcKV-2Ph6CzoDRqk0Ag", contentTypes: {"PDF": 2} }
  ]
  },
  {
    name: "Richard H. Thaler - Behavioral economics and decision-making psychology",
    id: "13HoS9esDkk1aVOOm_ujwj5swcLur5ybg",
    category: "Behavioral Science & Psychology",
    books: [
    { name: "Misbehaving - Richard H. Thaler", id: "15VaizTBUqr4yFCPmazwhGwurV2OHxAJA", contentTypes: {"Transcript": 2, "PDF": 1, "Binder": 1} },
    { name: "Nudge - Richard H. Thaler & Cass R. Sunstein", id: "1xo5tfbrLJO5Y0z_1wWxKvWu6zmsUgwBf", contentTypes: {"Transcript": 8, "PDF": 2, "Binder": 1} },
    { name: "Nudge", id: "1gbU3YJYSHxNTkOMGPbBRb3EHhLdJ4pu1", contentTypes: {"Binder": 1, "Transcript": 8, "PDF": 1} },
    { name: "Misbehaving The Making of Behavior Economics by Richard H. Thaler", id: "1yxkUfXlDg0kWwm35mkccIwuLYO_oAi4V", contentTypes: {"PDF": 2, "Transcript": 2, "Binder": 1} }
  ]
  },
  {
    name: "Rob Fitzpatrick - Startup validation and customer conversations",
    id: "1VCOMr-yLpTRS6YtW_QnSTf3zhRsB-SOX",
    category: "Business & Entrepreneurship",
    books: [
    { name: "The Mom Test - Rob Fitzpatrick", id: "1mYvPot5u5I433fv3geDpcDfXu7yuafft", contentTypes: {"Transcript": 2} },
    { name: "The Mom Test", id: "17gDaZQbS6adpkOk4at5261K0G8EfWsI-", contentTypes: {"Transcript": 2} }
  ]
  },
  {
    name: "Rob Walling - Bootstrapped SaaS entrepreneurship and mentorship",
    id: "1TdDqq7qNny0EyirMS5QXZaJDEVcJmpaM",
    category: "Business & Entrepreneurship",
    books: [
    { name: "The SaaS Playbook - Rob Walling", id: "1Sa-I_AtiHsCc126V5kusfqPjWvU_fkz9", contentTypes: {"PDF": 2, "Transcript": 2, "Binder": 1} }
  ]
  },
  {
    name: "Robert B. Cialdini - Behavioral psychology and ethical persuasion",
    id: "1BHTSIsTpYDUDKvWXtymiFWp5VU_5zwOt",
    category: "Sales & Negotiation",
    books: [
    { name: "Pre-Suasion - Robert B. Cialdini", id: "1JRCdMHrbDKNR5ohcGPxLahuyMAAqcNe-", contentTypes: {"PDF": 1} },
    { name: "Influence - Robert B. Cialdini", id: "1lI0vGQmWLsYoWYKIHXOvIpu41Apc6XlH", contentTypes: {"PDF": 2, "Transcript": 2, "Binder": 1} },
    { name: "Influence - New and Expanded The Psychology of Persuasion", id: "1G6UHDZPteXXAGffO2MQJ2LPLEjw0R9R_", contentTypes: {"Transcript": 2, "PDF": 1, "Binder": 1} }
  ]
  },
  {
    name: "Robert M Grant - Business Strategy",
    id: "1FZ0c4xj9YkSIvHNW0egNjbxSUffaOObd",
    category: "Strategy & Economics",
    books: [
    { name: "Contemporary Strategy Analysis", id: "1QYKni0Iy0D2SroPsC1G3DyAUqgJCic1w", contentTypes: {"PDF": 1} }
  ]
  },
  {
    name: "Sanjoy Mahajan - Problem Solving and Critical Thinking",
    id: "124VAHieGchqjPHLBVnXzn1aZhMIqObgk",
    category: "Self-Help & Productivity",
    books: [
    { name: "Street-Fighting Mathematics", id: "1wdK0yKo4b4T3-CQJub07r5eB3RsizqBM", contentTypes: {"PDF": 1} }
  ]
  },
  {
    name: "Scott Brinker - Marketing technology strategy and analysis",
    id: "19CbyON9j2MbiKv4HPX7I3DP_zI0GglHk",
    category: "Technology & Futurism",
    books: [
    { name: "Hacking Marketing", id: "1pWPNuVaULkQJCFjnw04Ltqdw5gxfswxC", contentTypes: {"PDF": 2} }
  ]
  },
  {
    name: "Scott Brinker - Marketing technology and agile marketing",
    id: "1kYO570UJOMcbZwJdNSM4QEtvMU7y-8EG",
    category: "Business & Entrepreneurship",
    books: [
    { name: "Hacking Marketing - Scott Brinker", id: "1wXvxuCnuJ6nNghQ48_Zlj6N0CtfIUTr5", contentTypes: {"Transcript": 3} }
  ]
  },
  {
    name: "Scott Galloway - business and tech author",
    id: "1H-JFJyKu82O2FKCHZekn4G0oYrZlLuB8",
    category: "Business & Entrepreneurship",
    books: []
  },
  {
    name: "Sean Ellis - Growth hacking and startup scaling",
    id: "1fUkvtxhiKuc4lEvlzlMpMOu09ubQ53gI",
    category: "Sales & Negotiation",
    books: [
    { name: "Hacking Growth", id: "1eBKqXmxguB-uHPdyH0Rs8_ICmCAV3xv0", contentTypes: {"PDF": 1} }
  ]
  },
  {
    name: "Sean Ellis - Growth hacking and product-led growth",
    id: "18wr4Q_SCS9wxF0k0e3FZVjXbxUf7IzOq",
    category: "Business & Entrepreneurship",
    books: [
    { name: "Hacking Growth - Sean Ellis & Morgan Brown", id: "1aSu24hVCwiqdRqXkpidF6j1S6YXwzcmk", contentTypes: {"Transcript": 3} }
  ]
  },
  {
    name: "Seth Godin - Marketing",
    id: "1h4ZdjDIB7e4jgKQJjiaoJx3X-M_X08bg",
    category: "Strategy & Economics",
    books: [
    { name: "The Dip_ A Little Book That Teaches You When to Quit", id: "1-z1rjy58UeUGr0sGEDJmowPdKlE_BtAI", contentTypes: {"PDF": 1} },
    { name: "All Marketers are Liars", id: "1O1391D0ABjXBNAwkMeYzz9VvrC_2KgIe", contentTypes: {"PDF": 1} }
  ]
  },
  {
    name: "Shankar Vedantam - Behavioral science and unconscious bias",
    id: "1yXfJFftdTKOG3ZTFJ26Jk_aD_hf8VZOJ",
    category: "Behavioral Science & Psychology",
    books: [
    { name: "The Hidden Brain - Shankar Vedantam", id: "1TbC3dYixr0HwjVK7rS-ncqZapEqR-0dd", contentTypes: {"Binder": 1, "Transcript": 4, "Podcasts": 1} },
    { name: "Hidden Brain", id: "1qBr4hxZMP659J3AYeeS9ASE9e1theMbW", contentTypes: {"Transcript": 4, "Binder": 1} },
    { name: "Podcasts", id: "1vf62UhDouy6FENKkb4Julw1YPHaLfyf0", contentTypes: {} }
  ]
  },
  {
    name: "Simon Sinek - Business Leadership",
    id: "1SjJTr1AmYEtt41PSrbnWMXO6KO_df459",
    category: "Leadership & Management",
    books: [
    { name: "Start with Why - Simon Sinek", id: "1q443zqkQVHx1eFn3LUn4X9GLbEuQzZD1", contentTypes: {"Transcript": 2} },
    { name: "Leaders Eat Last - Simon Sinek", id: "1KHUFlhvHcLey6QpwVKUEUs4XnX5GmVRz", contentTypes: {"Transcript": 2, "PDF": 1} },
    { name: "Start with Why", id: "1YsdXvJJmGkD3KaUFvMZ70OZRZaCKIzUV", contentTypes: {"Transcript": 2} },
    { name: "Leaders Eat Last", id: "1Bu26ALCCEhu2ZHxWuZIac9bUlA0NmLq9", contentTypes: {"Transcript": 2} }
  ]
  },
  {
    name: "Stephen Hawking - Theoretical physics and cosmology",
    id: "1o71l-4pcEMAsGOJsJa3_NdYdPgm4oqlO",
    category: "Technology & Futurism",
    books: [
    { name: "The Grand Design - Stephen Hawking & Leonard Mlodinow", id: "1JWX2BCfsfa3uXtxXx3Sbfqo5IcSgLWbx", contentTypes: {"Transcript": 4} }
  ]
  },
  {
    name: "Stephen R Poland - Startups",
    id: "1n_J1ac1djv8IAwPkTRvHvcSKjIdDdF1_",
    category: "Business & Entrepreneurship",
    books: [
    { name: "Founder\u2019s Pocket Guide", id: "1M6_UaJuWurDLsqcn_cWU8VsSzuathqdQ", contentTypes: {"PDF": 1} }
  ]
  },
  {
    name: "Stephen R. Covey - personal development and leadership",
    id: "1hVMmpDzEAefNeS-leUkMA9yxQIcxqLJZ",
    category: "Self-Help & Productivity",
    books: [
    { name: "The 7 Habits of Highly Effective People", id: "1r2tk0JJlYXJXXw_uI-fw5KNZ666ykBpV", contentTypes: {"PDF": 1} }
  ]
  },
  {
    name: "Steven Bartlett - Entrepreneurship, personal growth, and storytelling",
    id: "1PfDnY4jdfHnVeaTpfx3bNKxpzLp4p1TM",
    category: "Business & Entrepreneurship",
    books: [
    { name: "The Diary of a CEO - Steven Bartlett", id: "1EFlHIcttcyn649bmnAuKlvX7wqj29yrB", contentTypes: {"Transcript": 2} },
    { name: "The Diary of a CEO", id: "1Ecr8Fz1PfW0KWrNsvpeWCYlA3VfdDQDm", contentTypes: {"Transcript": 2} }
  ]
  },
  {
    name: "Stephen Hawking - Cosmology, black holes, theoretical physics",
    id: "108kovqiBGoPrTVknVGHyYmHnjUZ7ZEWx",
    category: "Technology & Futurism",
    books: [
    { name: "The Grand Design", id: "1LEApounEGSsQ3RY1IjpVUm40RkQukbNR", contentTypes: {"Transcript": 4} }
  ]
  },
  {
    name: "Sue Hawkes - Leadership development and self-empowerment",
    id: "1GzSGCON0JlaqPI3j4EWonLZizwKrVcKu",
    category: "Self-Help & Productivity",
    books: [
    { name: "Chasing Perfection", id: "1B_4y_IOOY8RdnOGoKlXqib33LSvAuy0b", contentTypes: {"Transcript": 2} }
  ]
  },
  {
    name: "Sue Hawkes - Leadership and organizational performance",
    id: "1oEbMcAB_P54dk4nYooJfDtfNJc4sfswT",
    category: "Business & Entrepreneurship",
    books: [
    { name: "Chasing Perfection - Sue Hawkes", id: "1sKFlAAus1NkH967vPlMlEWJTZlGYyKYg", contentTypes: {"Transcript": 2} }
  ]
  },
  {
    name: "Susin Nielsen - young adult (YA) fiction, middle-grade fiction, and coming-of-age storytelling",
    id: "1gbZeQtemUhVc9xHB9PQbpC3aTfjVg5b4",
    category: "Communication & Storytelling",
    books: [
    { name: "We Are All Made of Molecules", id: "1LWBgczNU-1TYpOe5fcxtF_T-7Rgod-fT", contentTypes: {"PDF": 1} }
  ]
  },
  {
    name: "Tom Yorton - Improv-based leadership and communication expert",
    id: "1x9qyD-JWjRQVrcujyTJdIiRtavZ9DGrX",
    category: "Leadership & Management",
    books: [
    { name: "Yes, And", id: "1Rhsk8Kw-tj-DbTiVNHgh3lC9EAtSewAO", contentTypes: {"PDF": 1} }
  ]
  },
  {
    name: "Uri Levine - Startup disruption and problem-centric innovation",
    id: "1712BfrR_uJUk69PEed0Zz1m7W1CQ2vMg",
    category: "Business & Entrepreneurship",
    books: [
    { name: "Fall in Love with the Problem, Not the Solution - Uri Levine", id: "184lFqr1ypP1kfST-E0iK0O8EMos-f2hN", contentTypes: {"PDF": 2, "Transcripts PDF": 6, "Binder": 1, "PDF Format": 1, "Transcripts doc": 4, "Notes": 1} }
  ]
  },
  {
    name: "Walter Isaacson - Innovator Biographies & Cultural History",
    id: "1uUsE4w9ljG5Wxlu08NcbteBhVawFSMS6",
    category: "History & Biography",
    books: [
    { name: "Steve Jobs", id: "1QNqU9-NySsYQPchHLrDFmcbyDJEBPt0v", contentTypes: {"PDF": 1} }
  ]
  },
  {
    name: "Will Guidara - hospitality and business author",
    id: "1iDf6uZM_1vxacmO6ugj_uATcrt8NwhMI",
    category: "Business & Entrepreneurship",
    books: [
    { name: "Unreasonable Hospitality - Will Guidara", id: "10zzAVGiEIdgc-_e_u15N_qAjJJCfCTgR", contentTypes: {"Transcript": 2} },
    { name: "Unreasonable Hospitality", id: "1IQEMjbONWQOEwKaAmjj9-ujCJ2H7BpPL", contentTypes: {"Transcript": 2} }
  ]
  },
  {
    name: "Yuval Noah Harari - Mcaro-History and Futurism",
    id: "1qLm3du7Ql0kHK5FDJLOwub3nfLB8L7vM",
    category: "History & Biography",
    books: [
    { name: "Sapiens", id: "1GV_wlUO9nXombN9zTgyogR45Jwibs9mI", contentTypes: {"PDF": 1} },
    { name: "Nexus", id: "1NjgwaLehU5YBbzXarWefHiOw7tjgKgtx", contentTypes: {"PDF": 1} }
  ]
  }
];
export const BOOKS: BookRecord[] = [
  { name: "10% Happier 10th Anniversary", id: "1iYQelUi4ztDlOMWSmdfnVFwzwchcpi4Q", category: "Self-Help & Productivity", contentTypes: {"PDF": 1} },
  { name: "100M Leads - Alex Hormozi", id: "17Msqkw27nKwVs1IgVvVN3-RmMT9SrESH", category: "Business & Entrepreneurship", contentTypes: {"Transcript": 2, "PDF": 2} },
  { name: "1929", id: "1ECWAyQymVgpcZcpGtVR-qjt8s6Ry-2mz", category: "Business & Entrepreneurship", contentTypes: {} },
  { name: "7 Powers_ The Foundations of Business Strategy", id: "1dZrAy0OCOUIfD-YV111zeZgLra3uBjRb", category: "Strategy & Economics", contentTypes: {"PDF": 1} },
  { name: "A Therapist\u2019s Guide to Consensual Nonmonogamy", id: "1WSlgHbrY3lGehPcKV-2Ph6CzoDRqk0Ag", category: "Behavioral Science & Psychology", contentTypes: {"PDF": 2} },
  { name: "Abundance", id: "1bAoVR0uH2rA7KoZ8otOEsJnMZPbGETSf", category: "Technology & Futurism", contentTypes: {"PDF": 1} },
  { name: "Active Listening", id: "1SBf3Z2_btMMIh-z8so09ztd_N67X7g2W", category: "Behavioral Science & Psychology", contentTypes: {"Transcript": 2, "Binder": 1, "PDF": 2} },
  { name: "Active Listening [3-in-1]", id: "1W6_9lq8lZjxgO5cuXen6XOHLJpC7cbLU", category: "Communication & Storytelling", contentTypes: {"PDF": 1} },
  { name: "Active Listening Techniques - Nixaly Leonardo", id: "1nlr__TWeNrMVbuA0mbfsesg5HI0SlcVH", category: "Self-Help & Productivity", contentTypes: {"Binder": 1, "Transcript": 2, "PDF": 2} },
  { name: "All Marketers are Liars", id: "1O1391D0ABjXBNAwkMeYzz9VvrC_2KgIe", category: "Strategy & Economics", contentTypes: {"PDF": 1} },
  { name: "Atomic Habits", id: "1uPppuJ1DIhx6xFDEVjQYy0eD63msGvYp", category: "Self-Help & Productivity", contentTypes: {"PDF": 1} },
  { name: "bk_rand_011854", id: "1_WT-lQd9dhG0VZ7BRscvxweODGDQrGRd", category: "Behavioral Science & Psychology", contentTypes: {"PDF": 1} },
  { name: "Book PDF", id: "1fModm50AVh2R-cKYEB1A2DKAU8cy_pLg", category: "Communication & Storytelling", contentTypes: {"Other": 1} },
  { name: "Book PDF", id: "12_SS0oighj-Lf4tiX4hHdw-3IE-GXfMY", category: "Behavioral Science & Psychology", contentTypes: {"Other": 1} },
  { name: "Building Successful Partner Channels", id: "1IKdOaQirZRfnZwy7I1Uks6-XirkNpn-r", category: "Sales & Negotiation", contentTypes: {"PDF": 1} },
  { name: "Building Successful Partner Channels", id: "1vfomGdTBRVTcI8A0dr8R9RinM0C4Mvbo", category: "Sales & Negotiation", contentTypes: {"ChatGPT": 4, "Transcript": 2, "Sana AI": 2, "Binder": 1} },
  { name: "Building Successful Partner Channels - Hans Peter Bech", id: "1mqClJDNBCZ6eQqEHk333mcaVlCUuBARI", category: "Sales & Negotiation", contentTypes: {"PDF": 1, "DOC": 3, "Transcript": 2, "Binder": 1, "ChatGPT": 4, "Sana AI": 2} },
  { name: "Charles Duhigg", id: "1Ck-hu-uKHF9uuMUeIZeI4QW9KkDoljIu", category: "Self-Help & Productivity", contentTypes: {"Images": 1} },
  { name: "Chasing Perfection", id: "1B_4y_IOOY8RdnOGoKlXqib33LSvAuy0b", category: "Self-Help & Productivity", contentTypes: {"Transcript": 2} },
  { name: "Chasing Perfection - Sue Hawkes", id: "1sKFlAAus1NkH967vPlMlEWJTZlGYyKYg", category: "Business & Entrepreneurship", contentTypes: {"Transcript": 2} },
  { name: "Contemporary Strategy Analysis", id: "1QYKni0Iy0D2SroPsC1G3DyAUqgJCic1w", category: "Strategy & Economics", contentTypes: {"PDF": 1} },
  { name: "Crossing the Chasm, 3rd Edition", id: "1Dk6FbYX9UfMfiZCCDSQ27NzhnXfOVC9M", category: "Technology & Futurism", contentTypes: {"PDF": 1} },
  { name: "David Brooks", id: "1lbZ-qgwAfJBZ_7E8HyPYrf4u9xLxlgAH", category: "Behavioral Science & Psychology", contentTypes: {"Images": 1} },
  { name: "Discovering Statistics", id: "1cQ-N4tV1tN3A2dmBUjqURI5iTkThhqYS", category: "Technology & Futurism", contentTypes: {"PDF": 2} },
  { name: "Do You Talk Funny", id: "1MENPJpka2e94jrVnNtgCtGIueZoVKCCn", category: "Communication & Storytelling", contentTypes: {"Transcript": 2} },
  { name: "Do You Talk Funny? - David Nihill", id: "1O-5P5n6I75o8RaGeOTPewtk6chw46sS2", category: "Communication & Storytelling", contentTypes: {"Transcript": 2} },
  { name: "Effortless Experience", id: "17YJ1Z17RLvbjG5Uj77SEWSoNcM7dflva", category: "Sales & Negotiation", contentTypes: {"Transcript": 2} },
  { name: "Fall in Love with the Problem, Not the Solution - Uri Levine", id: "184lFqr1ypP1kfST-E0iK0O8EMos-f2hN", category: "Business & Entrepreneurship", contentTypes: {"PDF": 2, "Transcripts PDF": 6, "Binder": 1, "PDF Format": 1, "Transcripts doc": 4, "Notes": 1} },
  { name: "Fanatical Prospecting - Jeb Blount", id: "1VxwSHR2z2dV9eQ8zxkCTwW4nbK1TkUtP", category: "Sales & Negotiation", contentTypes: {"PDF": 2, "Transcript": 6, "Cold Calling and ebooks": 20, "Additional DOC": 1, "Binder": 1} },
  { name: "Founder\u2019s Pocket Guide", id: "1M6_UaJuWurDLsqcn_cWU8VsSzuathqdQ", category: "Business & Entrepreneurship", contentTypes: {"PDF": 1} },
  { name: "Founder\u2019s Pocket Guide", id: "1wpi1t-RT41RbT7A8HCLLy4MLV2OJwyaA", category: "Business & Entrepreneurship", contentTypes: {"PDF": 2} },
  { name: "From Impossible to Inevitable - Aaron Ross & Jason Lemkin", id: "1WDz-1Qrhhtpsc8x2u3JUhbE3demLbjI8", category: "Sales & Negotiation", contentTypes: {"PDF": 1, "Transcript": 7, "Notes": 8, "Binder": 2} },
  { name: "Going Global on a Shoestring", id: "1eXmqZiENXh-JYS8YnIkttS8aVOhticZ4", category: "Sales & Negotiation", contentTypes: {"PDF": 1} },
  { name: "Good to Great (Summary) - Jim Collins", id: "1ft599AlLo1DQaoS4JIr-srbVgQSdvam9", category: "Strategy & Economics", contentTypes: {"Transcript": 2, "Additional DOC": 1} },
  { name: "Great Game Business", id: "1BLQrYn9EGcbk7GdGkbEr7NEtrk3wvGDX", category: "Business & Entrepreneurship", contentTypes: {"Transcript": 4} },
  { name: "Guesstimation 2.0", id: "15m_lC8PN78TCdkTlbDiU86D8X1h-nPk4", category: "Communication & Storytelling", contentTypes: {"PDF": 1} },
  { name: "Hacking Growth", id: "1eBKqXmxguB-uHPdyH0Rs8_ICmCAV3xv0", category: "Sales & Negotiation", contentTypes: {"PDF": 1} },
  { name: "Hacking Growth - Sean Ellis & Morgan Brown", id: "1aSu24hVCwiqdRqXkpidF6j1S6YXwzcmk", category: "Business & Entrepreneurship", contentTypes: {"Transcript": 3} },
  { name: "Hacking Marketing", id: "1pWPNuVaULkQJCFjnw04Ltqdw5gxfswxC", category: "Technology & Futurism", contentTypes: {"PDF": 2} },
  { name: "Hacking Marketing - Scott Brinker", id: "1wXvxuCnuJ6nNghQ48_Zlj6N0CtfIUTr5", category: "Business & Entrepreneurship", contentTypes: {"Transcript": 3} },
  { name: "Hidden Brain", id: "1qBr4hxZMP659J3AYeeS9ASE9e1theMbW", category: "Behavioral Science & Psychology", contentTypes: {"Transcript": 4, "Binder": 1} },
  { name: "Hidden Potential", id: "1-hqofS1N2zt9EInulrUrW6Yi5k_jhYtx", category: "Behavioral Science & Psychology", contentTypes: {"Transcript": 5, "PDF": 1, "Binder": 1} },
  { name: "Hidden Potential - Adam Grant", id: "1bfktwQlybWaX9XoOFOaNDBavvY9Se112", category: "Behavioral Science & Psychology", contentTypes: {"Transcript": 5, "Binder": 1, "PDF": 1, "temp": 1, "Complete Book in PDF": 1} },
  { name: "How to Decide", id: "1Vo36hxR7BOHFXeGPuUvF1_jkh9awqfTF", category: "Behavioral Science & Psychology", contentTypes: {"Other": 1} },
  { name: "How to Know a Person", id: "1VxZ8MwpD4CyulHVLhlP74j2SzNhmrC5p", category: "Behavioral Science & Psychology", contentTypes: {"Transcript": 22, "Binder": 1} },
  { name: "How to Know a Person - David Brooks", id: "1LmkKiT9Q9hrDFuJPIB2EE-Aduek6THZt", category: "Behavioral Science & Psychology", contentTypes: {"Video": 1, "Interview": 4, "Transcript": 22, "Binder": 1, "PDF": 1, "Interview Transcript": 4} },
  { name: "How to Lie with Statistics", id: "1U0JnMopPSQls50kV4zDMU7Sdl0odvFEb", category: "Self-Help & Productivity", contentTypes: {"PDF": 1} },
  { name: "How to Talk to Anyone", id: "1A4quNDJLjLc1Is8TZMyBjoDDRoOBt4cP", category: "Communication & Storytelling", contentTypes: {"Transcript": 2} },
  { name: "How to Talk to Anyone - Leil Lowndes", id: "1xoaF79V51AflPz_vug2J91QHypVLwFLu", category: "Communication & Storytelling", contentTypes: {"Transcript": 2} },
  { name: "How to Win Friends and Influence People - Dale Carnegie", id: "1VQZibcd-IVbEJB3nfPrxHsjsr0WTjzPh", category: "Behavioral Science & Psychology", contentTypes: {"PDF": 1} },
  { name: "Immune - Philipp Dettmer", id: "1qXrcdxlt1Onsp8DMQ5dynMbumanZZdYz", category: "Technology & Futurism", contentTypes: {"PDF": 1} },
  { name: "Immune by Philip Dettmer", id: "1qdxgljH6umlLWz4OZy3_ECOnm9fsVhpu", category: "Technology & Futurism", contentTypes: {"PDF": 1} },
  { name: "Influence - New and Expanded The Psychology of Persuasion", id: "1G6UHDZPteXXAGffO2MQJ2LPLEjw0R9R_", category: "Sales & Negotiation", contentTypes: {"Transcript": 2, "PDF": 1, "Binder": 1} },
  { name: "Influence - Robert B. Cialdini", id: "1lI0vGQmWLsYoWYKIHXOvIpu41Apc6XlH", category: "Sales & Negotiation", contentTypes: {"PDF": 2, "Transcript": 2, "Binder": 1} },
  { name: "Inside Steve", id: "17AK4qYmfpdGBvbwIWtFQxNTHkf9j800t", category: "History & Biography", contentTypes: {"PDF": 1} },
  { name: "Jefferson-Fisher-Open-Graph", id: "1jqq5leYMkm-7YBsgUCws9MwtfVmkBy1R", category: "Leadership & Management", contentTypes: {"Images": 1} },
  { name: "Lead Engaging Meetings - Jeff Shannon", id: "13q6csVhoaK3_t3xw8vDicrEGFeOyJqYQ", category: "Leadership & Management", contentTypes: {"Transcript": 3} },
  { name: "Leaders Eat Last", id: "1Bu26ALCCEhu2ZHxWuZIac9bUlA0NmLq9", category: "Leadership & Management", contentTypes: {"Transcript": 2} },
  { name: "Leaders Eat Last - Simon Sinek", id: "1KHUFlhvHcLey6QpwVKUEUs4XnX5GmVRz", category: "Leadership & Management", contentTypes: {"Transcript": 2, "PDF": 1} },
  { name: "Leading Engaging Meetings", id: "1kwYxOkaQVNdVcTLNMUM1fr6nJ9Mu3SGP", category: "Leadership & Management", contentTypes: {"Transcript": 3} },
  { name: "Lean Marketing - Allan Dib", id: "1aRk1ptZ9wr8YPaxjKG7yRLDEGtED-ggh", category: "Strategy & Economics", contentTypes: {"Transcript": 6} },
  { name: "Making Conversation", id: "1oMhOVvnN8Oop81V4V_KEB5OJZdJ1q4vb", category: "Communication & Storytelling", contentTypes: {"Transcript": 2} },
  { name: "Making Conversation - Fred Dust", id: "1lozeRuRw1Sdi8sz3HmYVHXxbL9R3C-wp", category: "Communication & Storytelling", contentTypes: {"Transcript": 2} },
  { name: "Mating in Captivity", id: "1CyOd2waOgUiIlqvDksUBcHDcmtxwMlfa", category: "Behavioral Science & Psychology", contentTypes: {"PDF": 1} },
  { name: "Meditations", id: "1aQiJCiqSIZ56ZlUgprzCFNZ4RBXdID1Q", category: "Self-Help & Productivity", contentTypes: {"PDF": 1} },
  { name: "Misbehaving - Richard H. Thaler", id: "15VaizTBUqr4yFCPmazwhGwurV2OHxAJA", category: "Behavioral Science & Psychology", contentTypes: {"Transcript": 2, "PDF": 1, "Binder": 1} },
  { name: "Misbehaving The Making of Behavior Economics by Richard H. Thaler", id: "1yxkUfXlDg0kWwm35mkccIwuLYO_oAi4V", category: "Behavioral Science & Psychology", contentTypes: {"PDF": 2, "Transcript": 2, "Binder": 1} },
  { name: "Move Fast and Fix Things", id: "1vh2kC9-FvtiD-z9ELteFx_ZeVkpgABta", category: "Leadership & Management", contentTypes: {"PDF": 1} },
  { name: "Mr. Monkey and Me", id: "1BvSybrviXygDvkGbwC3VIoFZSWBMR0f2", category: "Business & Entrepreneurship", contentTypes: {"PDF": 2} },
  { name: "Never Split the Difference - Chris Voss & Tahl Raz", id: "1G3CwjcOXweEw5nseCgurMAcpjU8KYips", category: "Sales & Negotiation", contentTypes: {"Transcript": 2, "Binder": 1, "Additional DOC": 2, "temp": 1, "Knowledge Base Files": 1} },
  { name: "Never Split the Difference by Chris Voss", id: "18WmHI23KP-LkA5-ZFIklxDUUdFT_K_cb", category: "Sales & Negotiation", contentTypes: {"PDF": 1, "Transcript": 2, "Binder": 1, "Additional DOC": 2, "Knowledge Base Files": 1} },
  { name: "New Business Road Test, The", id: "1ACy7potp148BHGMITFyJ_5ZrNPdMOc-0", category: "Business & Entrepreneurship", contentTypes: {"PDF": 1} },
  { name: "Nexus", id: "1NjgwaLehU5YBbzXarWefHiOw7tjgKgtx", category: "History & Biography", contentTypes: {"PDF": 1} },
  { name: "No - The Only Negotiating System You Need by Jim Camp", id: "1YOrCxHEXDWwzk3K6WqA7dQ5OhK6FsvjS", category: "Sales & Negotiation", contentTypes: {"Transcript": 3} },
  { name: "No: The Only Negotiating System You Need - Jim Camp", id: "1PNp26PHGsdlVzUc4B9ssfA57_GcDX1ZP", category: "Sales & Negotiation", contentTypes: {"Transcript": 3} },
  { name: "Nudge", id: "1gbU3YJYSHxNTkOMGPbBRb3EHhLdJ4pu1", category: "Behavioral Science & Psychology", contentTypes: {"Binder": 1, "Transcript": 8, "PDF": 1} },
  { name: "Nudge - Richard H. Thaler & Cass R. Sunstein", id: "1xo5tfbrLJO5Y0z_1wWxKvWu6zmsUgwBf", category: "Behavioral Science & Psychology", contentTypes: {"Transcript": 8, "PDF": 2, "Binder": 1} },
  { name: "Objections", id: "1B1TLe8j1TaJNau5L2vBa6X6MdwjtVbHZ", category: "Sales & Negotiation", contentTypes: {"PDF": 1} },
  { name: "Obviously Awesome", id: "183iMIzLbozSglxK6A8efdB4DDu4rJt_O", category: "Sales & Negotiation", contentTypes: {"PDF": 1} },
  { name: "Podcasts", id: "1vf62UhDouy6FENKkb4Julw1YPHaLfyf0", category: "Behavioral Science & Psychology", contentTypes: {} },
  { name: "Positioning", id: "1k6Z6cE_0HgCOAbQ2HRZ91ep3bdpuyU64", category: "Strategy & Economics", contentTypes: {"PDF": 1} },
  { name: "Pre-Suasion - Robert B. Cialdini", id: "1JRCdMHrbDKNR5ohcGPxLahuyMAAqcNe-", category: "Sales & Negotiation", contentTypes: {"PDF": 1} },
  { name: "Predictable Revenue - Aaron Ross & Marylou Tyler", id: "1qyLwgET3NNyyg5_KCYodRyQfPCXjpRSH", category: "Sales & Negotiation", contentTypes: {"Transcript": 7, "Binder": 1, "Knowledge Base": 4} },
  { name: "Quit", id: "1r4J2cWIjxgnhYlAvM4x4Fn1Vo-FSyzlP", category: "Behavioral Science & Psychology", contentTypes: {"Transcript": 2} },
  { name: "Quit - Annie Duke", id: "1AKc4rICLCTwuBRbOfgoOuf6TQWSFiMwY", category: "Behavioral Science & Psychology", contentTypes: {"temp": 1, "Transcript": 2, "PDF": 1} },
  { name: "Radical Candor", id: "1vIGB3aD_4L8h8LLYpm4ZTU3wpLnUFxFy", category: "Leadership & Management", contentTypes: {"Transcript": 2} },
  { name: "Radical Candor - Kim Scott", id: "1B9WVoaUqMN4U_NGqAeGohfxUj46nQslR", category: "Leadership & Management", contentTypes: {"Transcript": 2, "temp": 1, "PDF": 1} },
  { name: "Read Write Own", id: "1uix8b1Ua373i47VTdzsYaTrOo-gG5Dcj", category: "Technology & Futurism", contentTypes: {"PDF": 1} },
  { name: "Revenge of the Tipping Point", id: "1eyaVtXvuKu8yR_qGg0DJsaj2gfIM7eRT", category: "Behavioral Science & Psychology", contentTypes: {"PDF": 1} },
  { name: "Running Lean", id: "1fdZgJfUUwz8_7cPtAggr7KHo1TM0YUnD", category: "Business & Entrepreneurship", contentTypes: {"PDF": 3, "Transcript": 5, "Running Lean (3rd Edition)_ Iterate from Plan A to a Plan That Works": 1, "Binder": 1} },
  { name: "Running Lean - Ash Maurya", id: "1ez4A8ic2gbOYyG7wg6oK--jHSSRmjJ3V", category: "Business & Entrepreneurship", contentTypes: {"PDF": 1, "Binder": 1, "Transcript": 5, "Running Lean (3rd Edition)_ Iterate from Plan A to a Plan That Works": 1, "temp": 1} },
  { name: "Sales Pitch", id: "1_6-dpu6qlx_yDJuwp4tlQFhBfCadw375", category: "Sales & Negotiation", contentTypes: {"Transcript": 3} },
  { name: "Sales Pitch - April Dunford", id: "1g7hCAUgwSSrwlIHOhItrRXet-hSURfLB", category: "Sales & Negotiation", contentTypes: {"Transcript": 3, "PDF": 1} },
  { name: "Same as Ever", id: "1ziU8Ws5jvnm1VL3kayUc20KdQUyEtHaL", category: "Behavioral Science & Psychology", contentTypes: {"PDF": 1} },
  { name: "Sapiens", id: "1GV_wlUO9nXombN9zTgyogR45Jwibs9mI", category: "History & Biography", contentTypes: {"PDF": 1} },
  { name: "Scaling Lean", id: "1UfyFAoy44N5GOhrWove_MlEXyGpG17mi", category: "Business & Entrepreneurship", contentTypes: {"Transcript": 2, "Binder": 1, "PDF": 1} },
  { name: "Scaling Lean - Ash Maurya", id: "1jKF4E5T_OD4aAWarWwef46QakZaljzed", category: "Business & Entrepreneurship", contentTypes: {"Transcript": 2, "PDF": 2, "Binder": 1} },
  { name: "Slow Productivity - Cal Newport", id: "1VEW6EHlLzAmh0D4ndQtMt5iJSTvm030a", category: "Self-Help & Productivity", contentTypes: {"Additional DOC": 1, "Transcript": 2} },
  { name: "Slow Productivity The Lost Art of Accomplishment Without Burnout", id: "1IjHgqB_IP3-NKCp0l5MoazQOuqaaORxT", category: "Self-Help & Productivity", contentTypes: {"Transcript": 2, "Additional DOC": 1} },
  { name: "Small Data", id: "1XshuP57SscP1r7D4MV6g56vU8PwIE9cB", category: "Behavioral Science & Psychology", contentTypes: {"PDF": 1} },
  { name: "Small Data_ The Tiny Clues That Uncover Huge Trends", id: "1qLx0VK2E09CwWZZ8Yt4ZsBaTOAB0CEdp", category: "Behavioral Science & Psychology", contentTypes: {"PDF": 1} },
  { name: "Speed & Scale", id: "1mccV5TcMBNd4vQBrY56aBb19rLU-SiSF", category: "Strategy & Economics", contentTypes: {"PDF": 1} },
  { name: "Start with a No", id: "1gm3vZrfG13OVoBXAgjd1B2fjLem9jC9J", category: "Sales & Negotiation", contentTypes: {"PDF": 1} },
  { name: "Start with No - Jim Camp", id: "1_94vdT-9WrMMwoH4NCms7MjJJUrd8jNG", category: "Sales & Negotiation", contentTypes: {"Transcript": 2} },
  { name: "Start with Why", id: "1YsdXvJJmGkD3KaUFvMZ70OZRZaCKIzUV", category: "Leadership & Management", contentTypes: {"Transcript": 2} },
  { name: "Start with Why - Simon Sinek", id: "1q443zqkQVHx1eFn3LUn4X9GLbEuQzZD1", category: "Leadership & Management", contentTypes: {"Transcript": 2} },
  { name: "Statistics for the Rest of Us", id: "1B05zQaNyxjH_YvUhntx2phpnXjetJ9jh", category: "Self-Help & Productivity", contentTypes: {"PDF": 1} },
  { name: "Steve Jobs", id: "1QNqU9-NySsYQPchHLrDFmcbyDJEBPt0v", category: "History & Biography", contentTypes: {"PDF": 1} },
  { name: "Steve Jobs_ The Man Who Thought Different_ A Biography", id: "1RV71m_SLL3BBCTZU62M0uaPJdaMx2qqh", category: "History & Biography", contentTypes: {"PDF": 1} },
  { name: "Street-Fighting Mathematics", id: "1wdK0yKo4b4T3-CQJub07r5eB3RsizqBM", category: "Self-Help & Productivity", contentTypes: {"PDF": 1} },
  { name: "Summary of Jim Collins Good to Great Key Takeaways and Analysis", id: "1v7Fvuz6mcF0pETCUpr3Yylh020rvOJLv", category: "Strategy & Economics", contentTypes: {"Transcript": 2, "Additional DOC": 1} },
  { name: "Super Agers - Eric Topol", id: "1SM-XBvJjk_vkvXoDpySnsesyQpUwDPtY", category: "Technology & Futurism", contentTypes: {"PDF": 2, "DOC": 1, "Supplemental": 3, "Binder": 1} },
  { name: "Superagency", id: "1RWH-0ZyI8cRQ1Zp2N3JOwMqWLsuqZk8F", category: "Technology & Futurism", contentTypes: {"PDF": 1} },
  { name: "Supercommunicators", id: "1aCGhXBQpeUFVaI6nWKPuNbKFhCDKoT1n", category: "Self-Help & Productivity", contentTypes: {"Transcript": 2, "PDF": 5, "Binder": 1, "PDF Extra 2": 3} },
  { name: "Supercommunicators - Charles Duhigg", id: "1zmejGNVROHI2JL-u6Lu3M4DZljiUW2Ye", category: "Behavioral Science & Psychology", contentTypes: {"DOC": 2, "Transcript": 2, "PDF": 4, "Binder": 1, "PDF Extra 2": 3} },
  { name: "Talk", id: "1rw3wjRaCCmGsJHoYbAcnqyGRBU2F6eoZ", category: "Behavioral Science & Psychology", contentTypes: {"PDF": 1} },
  { name: "The 7 Habits of Highly Effective People", id: "1r2tk0JJlYXJXXw_uI-fw5KNZ666ykBpV", category: "Self-Help & Productivity", contentTypes: {"PDF": 1} },
  { name: "The AI Edge", id: "1fZ2bmxyrj1PmJuQgj8cpZ9V1pkijejtw", category: "Sales & Negotiation", contentTypes: {"PDF": 1} },
  { name: "The Autobiography of Benjamin Franklin", id: "1hVZUPmVcKov4v32ga-Nfz2S-1Ve2k7p_", category: "History & Biography", contentTypes: {"PDF": 1} },
  { name: "The Challenger Customer", id: "1YUnq2Y149o6YsFmSUCbKjIWsPs6Z1POe", category: "Sales & Negotiation", contentTypes: {"Transcript": 2, "Additional DOC": 1, "PDF": 1} },
  { name: "The Challenger Customer - Brent Adamson & Matthew Dixon", id: "1EkT7zRqbCEP0CKLL52-uCX13NXEAd6rV", category: "Sales & Negotiation", contentTypes: {"Transcript": 2, "Additional DOC": 1} },
  { name: "The Challenger Sale", id: "1izD-UipjU_cTuH0GVyf2-4lPfnBfvegf", category: "Sales & Negotiation", contentTypes: {"PDF": 1, "Transcript": 2} },
  { name: "The Challenger Sale - Matthew Dixon & Brent Adamson", id: "1XaVejPCfUDzAdRdW8uXsSxYu3iMXiFLs", category: "Sales & Negotiation", contentTypes: {"Transcript": 2} },
  { name: "The Customer Success Professional Handbook", id: "1SymnayKM0HtfSwcEKpNGdetFXz_02XqM", category: "Business & Entrepreneurship", contentTypes: {"Transcript": 2, "Binder": 1, "PDF": 1} },
  { name: "The Customer Success Professional's Handbook - Ashvin Vaidyanathan & Ruben Rabago", id: "1v6qQfLinISHr7tDPsFOuVHJ1aRZL69Vq", category: "Business & Entrepreneurship", contentTypes: {"Transcript": 2, "Additional DOC": 1} },
  { name: "The Diary of a CEO", id: "1Ecr8Fz1PfW0KWrNsvpeWCYlA3VfdDQDm", category: "Business & Entrepreneurship", contentTypes: {"Transcript": 2} },
  { name: "The Diary of a CEO - Steven Bartlett", id: "1EFlHIcttcyn649bmnAuKlvX7wqj29yrB", category: "Business & Entrepreneurship", contentTypes: {"Transcript": 2} },
  { name: "The Dip_ A Little Book That Teaches You When to Quit", id: "1-z1rjy58UeUGr0sGEDJmowPdKlE_BtAI", category: "Strategy & Economics", contentTypes: {"PDF": 1} },
  { name: "The Effortless Experience - Matthew Dixon, Nick Toman & Rick DeLisi", id: "1H_U8c21YGkmOhTw80D4754i1e4vPr8Az", category: "Sales & Negotiation", contentTypes: {} },
  { name: "The Grand Design", id: "1LEApounEGSsQ3RY1IjpVUm40RkQukbNR", category: "Technology & Futurism", contentTypes: {"Transcript": 4} },
  { name: "The Grand Design - Stephen Hawking & Leonard Mlodinow", id: "1JWX2BCfsfa3uXtxXx3Sbfqo5IcSgLWbx", category: "Technology & Futurism", contentTypes: {"Transcript": 4} },
  { name: "The Great Game of Business - Jack Stack & Bo Burlingham", id: "19WqPA4b6zA_s4Zbq6YH4Pw5LasiHhWTJ", category: "Business & Entrepreneurship", contentTypes: {"Transcript": 4} },
  { name: "The Hidden Brain - Shankar Vedantam", id: "1TbC3dYixr0HwjVK7rS-ncqZapEqR-0dd", category: "Behavioral Science & Psychology", contentTypes: {"Binder": 1, "Transcript": 4, "Podcasts": 1} },
  { name: "The Jolt Effect", id: "1pYTYd8QeBxKyUugXCE8JbGzYTC28-95U", category: "Sales & Negotiation", contentTypes: {"Summaries PDF": 7, "Transcript": 2, "PDF": 6, "DOC": 1, "Binder PDF": 1, "temp": 1, "Summaries DOC": 8} },
  { name: "The JOLT Effect - Matthew Dixon & Ted McKenna", id: "1W6e5U6oL9nxj7QEDi2kS8r13rDv6EfvN", category: "Sales & Negotiation", contentTypes: {"Transcript": 2, "Summaries PDF": 7, "PDF": 5, "DOC": 1, "Binder PDF": 1, "temp": 1, "Summaries DOC": 8} },
  { name: "The Last Man Who Knew Everything", id: "196eQguirea8hamxgeaiOJP4MXT-rFZdG", category: "History & Biography", contentTypes: {"DOC": 4, "Transcript": 2, "Binder": 1, "PDF": 1} },
  { name: "The Last Man Who Knew Everything - David N. Schwartz", id: "1q2loPoDX7-m-iYdLdpMCPF2tqd97XjZw", category: "History & Biography", contentTypes: {"DOC": 4, "Binder": 1, "PDF": 2, "Transcript": 2} },
  { name: "The Leader's Guide - Eric Ries", id: "1cWvaeSPyc1Wrmce3nJW0UJy4rTdSkYUJ", category: "Business & Entrepreneurship", contentTypes: {"Transcript": 2, "PDF": 1, "Binder": 1} },
  { name: "The Leaders Guide", id: "1ljS-gwcrkU4Mxj4OsM65_S-MYS2AlrDM", category: "Business & Entrepreneurship", contentTypes: {"Transcript": 2, "Binder": 1, "PDF": 1} },
  { name: "The Lean Startup", id: "1WF85y-8R0XzmBVlr3kvkKQrq34WRwiM5", category: "Business & Entrepreneurship", contentTypes: {"PDF Version": 2} },
  { name: "The Lean Startup - Eric Ries", id: "1eQpIYY_SFNBTLou48nSSxcvQsgrW3III", category: "Business & Entrepreneurship", contentTypes: {"PDF Version": 2, "PDF": 1} },
  { name: "The Let Them Theory", id: "1I4H28e0Wc_3yNdGIklWAGeE6s8wT8Bye", category: "Self-Help & Productivity", contentTypes: {"PDF": 1} },
  { name: "The Let Them Theory - Mel Robbins", id: "1xYxXc_MXdNfoAFQPUrWVs7dqnD_TuA-Q", category: "Self-Help & Productivity", contentTypes: {"PDF": 1} },
  { name: "The Mom Test", id: "17gDaZQbS6adpkOk4at5261K0G8EfWsI-", category: "Business & Entrepreneurship", contentTypes: {"Transcript": 2} },
  { name: "The Mom Test - Rob Fitzpatrick", id: "1mYvPot5u5I433fv3geDpcDfXu7yuafft", category: "Business & Entrepreneurship", contentTypes: {"Transcript": 2} },
  { name: "The Neurology of We", id: "18koEbulUch7Z3maNGidOZEcm6FHpXP0z", category: "Behavioral Science & Psychology", contentTypes: {"Transcript": 2} },
  { name: "The Next 100 Years - George Friedman", id: "1xOi_k5ZsTKeA80YVyAS7Q2pkz8ptRUil", category: "Strategy & Economics", contentTypes: {"PDF": 2} },
  { name: "The Next Conversation", id: "1d6G92kvciP76VfvzPPSG2E9dCvhCVRWD", category: "Leadership & Management", contentTypes: {"PDF": 1} },
  { name: "The Perfect Story - Karen Eber", id: "1aijNrOPzCPlDgrFAJC5u07Q8fwQeBFKT", category: "Communication & Storytelling", contentTypes: {"PDF": 1} },
  { name: "The Power of Habit", id: "1NnP0Cl67rohkjnj2UfecCoNMnLWT3iNf", category: "Self-Help & Productivity", contentTypes: {"Other": 1} },
  { name: "The Power of Habit - Charles Duhigg", id: "1Kkzy_9Zw8MffVAZieI-e9F_hBOsj-aUl", category: "Behavioral Science & Psychology", contentTypes: {"Transcript": 4, "PDF Extras": 3, "Binder": 1} },
  { name: "The Psychology of Money", id: "14_d-zGN8dKJWFgJWAlG0jaU7JJrBpcYp", category: "Behavioral Science & Psychology", contentTypes: {"PDF": 1} },
  { name: "The Road to Character", id: "1wyhPih8syeaL2rqPMjF8KbWtPw492L6K", category: "Behavioral Science & Psychology", contentTypes: {"Transcript": 3} },
  { name: "The Road to Character - David Brooks", id: "168xjl9eJ6rF6cD4pubQIQB3Jr9mF4a3W", category: "Behavioral Science & Psychology", contentTypes: {"Transcript": 3, "temp": 1, "PDF": 1} },
  { name: "The SaaS Playbook - Rob Walling", id: "1Sa-I_AtiHsCc126V5kusfqPjWvU_fkz9", category: "Business & Entrepreneurship", contentTypes: {"PDF": 2, "Transcript": 2, "Binder": 1} },
  { name: "The Sales EQ", id: "1LIVcpC_TZr5rq7YC8E2kAFs1okZXANar", category: "Sales & Negotiation", contentTypes: {"Other": 1} },
  { name: "The Second Mountain - David Brooks", id: "1iKh5TRB2tnp_DWzSjVK7t0QsITlK9aSb", category: "Behavioral Science & Psychology", contentTypes: {"PDF": 1, "Transcript": 4, "Binder": 1} },
  { name: "The Singularity Is Nearer", id: "18HIndvGU-uJf5nb2LoUYnG3CWP6hdluH", category: "Technology & Futurism", contentTypes: {"PDF": 2} },
  { name: "The Social Animal", id: "1FPgE0bA5yiBIIyURg6gYt7sneCtbHY6y", category: "Behavioral Science & Psychology", contentTypes: {"PDF": 1} },
  { name: "The Soulful Art of Persuasion", id: "19nd9ARGes5Z_H-dIFRtavgtefMg5pZbu", category: "Communication & Storytelling", contentTypes: {"PDF": 1} },
  { name: "The Startup Way", id: "1qANI-oOCLDvGYCduNU9r89rK8sp3_HsR", category: "Business & Entrepreneurship", contentTypes: {"Other": 1} },
  { name: "The State of Affairs", id: "1auK9vf48-4R4q3Fngf2az-U_qwzgdJ73", category: "Behavioral Science & Psychology", contentTypes: {"PDF": 1} },
  { name: "The Tipping Point", id: "1TWPNOt1NR8m165e2ueHlgK_kq7dg_tLY", category: "Behavioral Science & Psychology", contentTypes: {"PDF": 1} },
  { name: "The Whole-Brain Child - Daniel J. Siegel & Tina Payne Bryson", id: "1JNzGaF1oM1t-Gi2srg8RAoYhGlkhqfLG", category: "Behavioral Science & Psychology", contentTypes: {"Transcript": 2} },
  { name: "The Wisdom of Crowds", id: "12PncZ5EdK7gcumzFQGZD-GBy8apt_GIV", category: "Behavioral Science & Psychology", contentTypes: {"PDF": 2} },
  { name: "Thinking, Fast and Slow", id: "1TQt97XiJpyx-oFE_q6VihF8WXa4rrBN1", category: "Behavioral Science & Psychology", contentTypes: {"PDF": 1} },
  { name: "Thinking, Fast and Slow - Daniel Kahneman", id: "1SdHKKUrZDyEbJh6zQfsKpUHjQZvTzNZp", category: "Behavioral Science & Psychology", contentTypes: {"PDF": 1} },
  { name: "Thrive", id: "1fluwT2MyKYTCyyNKw6C5-oAJQEnLIwAo", category: "Business & Entrepreneurship", contentTypes: {"PDF": 1} },
  { name: "Traction", id: "1L3iF7E0qpnJbGnomn9XtnWMV-JSJ0RMy", category: "Business & Entrepreneurship", contentTypes: {"PDF": 1} },
  { name: "Unreasonable Hospitality", id: "1IQEMjbONWQOEwKaAmjj9-ujCJ2H7BpPL", category: "Business & Entrepreneurship", contentTypes: {"Transcript": 2} },
  { name: "Unreasonable Hospitality - Will Guidara", id: "10zzAVGiEIdgc-_e_u15N_qAjJJCfCTgR", category: "Business & Entrepreneurship", contentTypes: {"Transcript": 2} },
  { name: "We Are All Made of Molecules", id: "1LWBgczNU-1TYpOe5fcxtF_T-7Rgod-fT", category: "Communication & Storytelling", contentTypes: {"PDF": 1} },
  { name: "What You Do Is Who You Are", id: "1BQQ2VtK8HTHqnbR3EPOuRHIxuifp1fmB", category: "History & Biography", contentTypes: {"PDF": 1} },
  { name: "What You Do Is Who You Are", id: "1Gf1ewZ7mQjTPfqdaTDBpt53rmZ84VIse", category: "Leadership & Management", contentTypes: {"PDF": 1} },
  { name: "Working Backwards", id: "1bHXpoAU0e3yjzbJZKKMfG5-IMg5xccml", category: "Business & Entrepreneurship", contentTypes: {"PDF": 1} },
  { name: "Yes, And", id: "1Rhsk8Kw-tj-DbTiVNHgh3lC9EAtSewAO", category: "Leadership & Management", contentTypes: {"PDF": 1} },
  { name: "Yes, And", id: "1EM5j9FcD85BEZQ8r8gxXWndtpipsTptU", category: "Leadership & Management", contentTypes: {"PDF": 1} },
  { name: "Yes, And - Kelly Leonard & Tom Yorton", id: "1fB1i5bKbwTWJAT1HiR5h8TKTK0zAuFrv", category: "Communication & Storytelling", contentTypes: {"Transcript": 4} }
];


export const CATEGORIES = [
  "Business & Entrepreneurship",
  "Sales & Negotiation",
  "Leadership & Management",
  "Communication & Storytelling",
  "Behavioral Science & Psychology",
  "Self-Help & Productivity",
  "Strategy & Economics",
  "Health & Science",
  "History & Biography",
] as const;

export type Category = typeof CATEGORIES[number];
