// Ricardo Cidale's Library - Books Audio Data
// Source: Google Drive Books Audio folder
// Last updated: March 13, 2026

export interface AudioFormat {
  folderId: string;
  fileCount: number;
}

export interface AudioBook {
  id: string;
  title: string;
  bookAuthors: string;
  formats: Record<string, AudioFormat>;
}

export const AUDIO_BOOKS: AudioBook[] = [
  {
    id: "1t8Ex3pR2UwwTj2sYgR7coIP0uGq1PfBX",
    title: "$100M Leads",
    bookAuthors: "Alex Hormozi",
    formats: {"MP3": {"folderId": "12ZDIwclJg81LtL8Ac9wSJt691DHtJ9Rs", "fileCount": 1}},
  },
  {
    id: "1D00jb9KE__sNQFq8gjN7mJsgrHPZqFZl",
    title: "Active Listening Techniques",
    bookAuthors: "Nixaly Leonardo",
    formats: {"MP3": {"folderId": "1PSez7njCifVSFIPwDqq12OGDP0RwA357", "fileCount": 1}},
  },
  {
    id: "14LbZojMDHZDj9b3yuMgRlW-4eeLKKvT_",
    title: "Chasing Perfection",
    bookAuthors: "Sue Hawkes",
    formats: {"MP3": {"folderId": "1seFflIK9RyFpNAluF8XgkwsuKXEgOz_z", "fileCount": 1}},
  },
  {
    id: "1q8sR7nu2pzlGxK5A7aT_3BURU2g87deY",
    title: "Do You Talk Funny?",
    bookAuthors: "David Nihill",
    formats: {"MP3": {"folderId": "1ZEtpI1fiJRejzv2JoMWBsNoB62j9bagc", "fileCount": 1}},
  },
  {
    id: "1pQh9z9eNoyPjRtKmOi73bCRxIwohhlfh",
    title: "Good to Great (Summary)",
    bookAuthors: "Jim Collins",
    formats: {"MP3": {"folderId": "1c1Vl_Tpm7SX7Gijbee3obSiWY6sYXUL1", "fileCount": 1}},
  },
  {
    id: "1P8wGPzIQcaENeHwkYEk3Jeur29aZiRP1",
    title: "Hacking Growth",
    bookAuthors: "Sean Ellis & Morgan Brown",
    formats: {"MP3": {"folderId": "1FJls2k3FhqBfylHwksc3nd-uYxaHjek0", "fileCount": 1}},
  },
  {
    id: "1fi6RQoV7TC_YdR7KpgMfmLbM3QjUXkRp",
    title: "Hacking Marketing",
    bookAuthors: "Scott Brinker",
    formats: {"M4B": {"folderId": "1bN3OYGpg2AkcF9F8fjTEwEU2D0ahOs9h", "fileCount": 26}},
  },
  {
    id: "1uxAx5bsdJ8o71YL9Wj5XeWpbMRiP5vX3",
    title: "Hidden Potential",
    bookAuthors: "Adam Grant",
    formats: {"M4B": {"folderId": "1mNQHCDPCBZm3RRo88phao5hlttBJZeu-", "fileCount": 2}},
  },
  {
    id: "10yaSRymZai-6cbeAVkYd8fGZVFobLpIk",
    title: "How to Know a Person",
    bookAuthors: "David Brooks",
    formats: {"M4B": {"folderId": "1Tp9jpHTLKoOS78DVaizoonV4QicMHfR3", "fileCount": 14}, "MP3": {"folderId": "1QA1_hgUSEFARNzcEW1hHwcFHWjaj9Rey", "fileCount": 1}},
  },
  {
    id: "1at9LqDowXQYAnf4tF_1y9KZ0WuyO1Gbf",
    title: "How to Talk to Anyone",
    bookAuthors: "Leil Lowndes",
    formats: {"MP3": {"folderId": "1ZucJWq7VLxS7Ohl3jOG1je52dBtz4i2g", "fileCount": 2}},
  },
  {
    id: "13F36yvT_gbLbv73xB8kPj-DFFZBi77Sk",
    title: "Influence",
    bookAuthors: "Robert B. Cialdini",
    formats: {"MP3": {"folderId": "1lmP34j0p5Lcl6fSbiRAFaTvSxqWJ0tdP", "fileCount": 1}},
  },
  {
    id: "1kWvkMvHPWIjN9jSDN0h7ogHo3OLtp-G2",
    title: "Lead Engaging Meetings",
    bookAuthors: "Jeff Shannon",
    formats: {"MP3": {"folderId": "1DEswwQLktoaq2RB9gXMmyVpz2UUE9745", "fileCount": 1}},
  },
  {
    id: "1afoFxJKqCM8SwIYNnFEK38LAtNGDJZnd",
    title: "Leaders Eat Last",
    bookAuthors: "Simon Sinek",
    formats: {"MP3": {"folderId": "1UQEvmPZmfDuXbe7lwHRvtR3ABGSM5CYI", "fileCount": 1}},
  },
  {
    id: "1tNVcdOJ2icuZV6quwLn5zOaO1DG-glak",
    title: "Lean Marketing",
    bookAuthors: "Allan Dib",
    formats: {"MP3": {"folderId": "1xHI_l7fL0AhTp6mnSnXH0a31zCLMaVII", "fileCount": 1}},
  },
  {
    id: "1--mE5kw5CASr4H1O_vgH9qlB8j-POMTu",
    title: "Making Conversation",
    bookAuthors: "Fred Dust",
    formats: {"MP3": {"folderId": "1irQfM-sF-TjxViJG30IicGXOTsvdogWj", "fileCount": 1}},
  },
  {
    id: "1bxnZyOFCxW0PntK1JrB6FUufSSw1-izk",
    title: "Misbehaving",
    bookAuthors: "Richard H. Thaler",
    formats: {"MP3": {"folderId": "144nX66djKo3Zo5U_XnIt48_pl2vCziUX", "fileCount": 2}},
  },
  {
    id: "1XnIPA_gMEgKO9NXM3OfG8KGlv9KR9lOW",
    title: "Never Split the Difference",
    bookAuthors: "Chris Voss & Tahl Raz",
    formats: {"M4B": {"folderId": "1z6CHiaSzluuetIJIREgF-E__3HzclJ6R", "fileCount": 12}, "MP3": {"folderId": "1DvIWRaqeIU6kDE-iKqQ9VFYzdy-OofEA", "fileCount": 1}},
  },
  {
    id: "1PKbDCAeGs40_TsG-sVB7bu7xRHNYFQxX",
    title: "No: The Only Negotiating System You Need",
    bookAuthors: "Jim Camp",
    formats: {"MP3": {"folderId": "1Xuhe4B95QF27cdLax-3Yq8EZt98j-t8n", "fileCount": 1}},
  },
  {
    id: "19TIZXvRnl_PDS-62UvXFHmrHFzT2OA5J",
    title: "Quit",
    bookAuthors: "Annie Duke",
    formats: {"MP3": {"folderId": "1dVs0qRUT6esz6gb2zC4l3cAQymYY4-tL", "fileCount": 1}},
  },
  {
    id: "1EYkevAO1sNRwW9go9pqaqpKkzVX7tnnR",
    title: "Radical Candor",
    bookAuthors: "Kim Scott",
    formats: {"M4B": {"folderId": "1ZuC0pnKbkoKoY8sW9nkMcqW8h-bg7rmf", "fileCount": 17}, "MP3": {"folderId": "1KQcFzKe5iSKRaSNo36jQ7clcQzjcXV_z", "fileCount": 1}},
  },
  {
    id: "1O4Eu9uvCfuWisMPFCv3qt7kKGXRSIz4k",
    title: "Running Lean",
    bookAuthors: "Ash Maurya",
    formats: {"M4B": {"folderId": "1LzibQkgK374GxAVpjYtxRZrL8mphHRBz", "fileCount": 24}, "MP3": {"folderId": "1weM10V8g6ShVVODOyii4pMyFX5MmF7DM", "fileCount": 1}},
  },
  {
    id: "1WJKefv3uzStEBiUwADHcyfDdamvLAsoy",
    title: "Sales Pitch",
    bookAuthors: "April Dunford",
    formats: {"MP3": {"folderId": "1epmSZaguFFfsqA_TAcdepCg-eXUWQ0Dg", "fileCount": 1}},
  },
  {
    id: "1-WUdJVUAGW80qWZTP86AY_CnH2TGIhkC",
    title: "Scaling Lean",
    bookAuthors: "Ash Maurya",
    formats: {"MP3": {"folderId": "1lvw2uYaTEIgj3fwyd-t_OgBsM-fx8V2g", "fileCount": 1}},
  },
  {
    id: "1t4efWFd3dYyNMxhM9np-u6HGmH0x86jz",
    title: "Slow Productivity",
    bookAuthors: "Cal Newport",
    formats: {"MP3": {"folderId": "15kQTLSMd4TYa3wodaIPZWLw-eIATdHVl", "fileCount": 1}},
  },
  {
    id: "1MS8iQj1D2J_o476vfkfeP3kbzGAeWz1M",
    title: "Start with No",
    bookAuthors: "Jim Camp",
    formats: {"MP3": {"folderId": "1jdFu6fgXXS_uP-qGyEHY5rZ-nm57Rn2J", "fileCount": 1}},
  },
  {
    id: "1yO_bI93N1Vi5bXubd45pxd5OxxEHuq62",
    title: "Start with Why",
    bookAuthors: "Simon Sinek",
    formats: {"MP3": {"folderId": "18yUBsSvld7ubMnoxTyybAdOlla1Ws-LJ", "fileCount": 1}},
  },
  {
    id: "19GBDkdNamVNh3LYgHei0pGAXrF-DYf2v",
    title: "Super Agers",
    bookAuthors: "Eric Topol",
    formats: {"MP3": {"folderId": "12MIBB3RpIa0xBPO4GwzFX0ECV3wTyL_q", "fileCount": 1}},
  },
  {
    id: "1ocOYYmya_tfBi1Ms7lZBeGhyGJIN_1sa",
    title: "The Challenger Customer",
    bookAuthors: "Brent Adamson & Matthew Dixon",
    formats: {"MP3": {"folderId": "1gmhcHqRjHAhehv9Mc_SDdNe3qLahG7b1", "fileCount": 1}},
  },
  {
    id: "193_z7z0UTLOp11i14hWxNHXnp5gF9Rts",
    title: "The Challenger Sale",
    bookAuthors: "Matthew Dixon & Brent Adamson",
    formats: {"M4B": {"folderId": "1b32gX5a8yQrShOvFl0ZyHyp_imDpnJ6X", "fileCount": 11}, "MP3": {"folderId": "1z61gUYs7DOGDnkysH25G78vWQ8uQp13W", "fileCount": 1}},
  },
  {
    id: "12a2AADy7wPggxFGXOOJZYafqBBUMCvUx",
    title: "The Customer Success Professional's Handbook",
    bookAuthors: "Ashvin Vaidyanathan & Ruben Rabago",
    formats: {"MP3": {"folderId": "1NVGAukbb67-L-xmbSa0hQDIxebTMBul2", "fileCount": 1}},
  },
  {
    id: "1tilurQvYS3mMTtdjWwphSnFKjxo4P6TU",
    title: "The Diary of a CEO",
    bookAuthors: "Steven Bartlett",
    formats: {"MP3": {"folderId": "16y6Gfy6QgX0KzNzILALhRZCxpehZ1ofA", "fileCount": 1}},
  },
  {
    id: "1NFN0dXp2sdr1j7dOJT1pVsJotK8gRmyh",
    title: "The Effortless Experience",
    bookAuthors: "Matthew Dixon, Nick Toman & Rick DeLisi",
    formats: {"MP3": {"folderId": "1LvWv_xW-n1av6uSsXSh7-St_XsyQvy41", "fileCount": 1}},
  },
  {
    id: "1QX-Q_-RCkIXccEiJxQ_MNDItnU3e8WqZ",
    title: "The Grand Design",
    bookAuthors: "Stephen Hawking & Leonard Mlodinow",
    formats: {"MP3": {"folderId": "1rNBtqU8E822dpH9VpGLe525Y44XLZdaX", "fileCount": 1}},
  },
  {
    id: "1rzouD9N3NOWGBnLnkq8VbuSR0zoOdawB",
    title: "The Great Game of Business",
    bookAuthors: "Jack Stack & Bo Burlingham",
    formats: {"MP3": {"folderId": "1PZ8-poYpGBH-0zqyoQhzutT1Lxzhk4CI", "fileCount": 1}},
  },
  {
    id: "1nL-N5kJfN_qwWmowy6mnhaD69Z6kK4f0",
    title: "The JOLT Effect",
    bookAuthors: "Matthew Dixon & Ted McKenna",
    formats: {"M4B": {"folderId": "1e3MKDds0hWOl1b8WcUYw43QAZkwf41r1", "fileCount": 17}, "MP3": {"folderId": "1yzV1x-TUdyrhfpti1N-WJt_XVQQfs5zE", "fileCount": 1}},
  },
  {
    id: "1HkV1W0vTD_9JMVtKg8et6hKjKjWBNQqx",
    title: "The Last Man Who Knew Everything",
    bookAuthors: "David N. Schwartz",
    formats: {"MP3": {"folderId": "18D3ydqN9Jrg6on8RP36vtXnBEUNuieRF", "fileCount": 4}},
  },
  {
    id: "1g0pFL94kojMWtHoSBmMy3BG6xclI-Ty-",
    title: "The Leader's Guide",
    bookAuthors: "Eric Ries",
    formats: {"MP3": {"folderId": "1PXXt2JNnhHyiQ7DVbev18V4uBulZ0erg", "fileCount": 1}},
  },
  {
    id: "1YWnG_90-DnJ6ERZxr7THO-2Szc1lcOK9",
    title: "The Mom Test",
    bookAuthors: "Rob Fitzpatrick",
    formats: {"MP3": {"folderId": "1CtEF1eq_gRq2DkZh3FtabOBF4EptZa5E", "fileCount": 1}},
  },
  {
    id: "1RNlU2jpuN7Wv2JuslqxpNOERn7nICEBN",
    title: "The Power of Habit",
    bookAuthors: "Charles Duhigg",
    formats: {"MP3": {"folderId": "1KGTNurLY5MvN6ZrE5MHBWjL6tR7_VeEA", "fileCount": 3}},
  },
  {
    id: "1TF_LH1Md2UWWhLTw_FAo7BZUA4WmGZKW",
    title: "The Road to Character",
    bookAuthors: "David Brooks",
    formats: {"M4B": {"folderId": "1nUui9WClvsfc6vPrz8zhh36bO6No_AoT", "fileCount": 12}, "MP3": {"folderId": "14SOW9-hT_ImfEVfBesryvvNoRN5-yIx5", "fileCount": 1}},
  },
  {
    id: "1TRrYgwCTCMRNgNyPyqZeaeQ-V96k6SQe",
    title: "The SaaS Playbook",
    bookAuthors: "Rob Walling",
    formats: {"MP3": {"folderId": "1o-FUpRQrqFgwO4OhJlePtI5vkYM7T_Dy", "fileCount": 1}},
  },
  {
    id: "1GS6Q3n7kyiRvzwJSGpuVd2cqoyQvJQAr",
    title: "The Second Mountain",
    bookAuthors: "David Brooks",
    formats: {"MP3": {"folderId": "1Xtq9lA8ZXjYgHW4yIdD0qQni6MXQ5UBc", "fileCount": 2}},
  },
  {
    id: "1Z608N5AfNsXdTw7ZZbFSYrhBu63IujPr",
    title: "The Whole-Brain Child",
    bookAuthors: "Daniel J. Siegel & Tina Payne Bryson",
    formats: {"MP3": {"folderId": "1_ACdkaZ8gBTsFULqkyds25BQA2brfC0Y", "fileCount": 1}},
  },
  {
    id: "1EsmRKAfYlYaAANHR6E-pcvs9t63eFLhb",
    title: "Unreasonable Hospitality",
    bookAuthors: "Will Guidara",
    formats: {"MP3": {"folderId": "1U5HLoKoDlufHWg1_YGquvGCx8AkS4d7S", "fileCount": 1}},
  },
  {
    id: "1VXPWnnHG7R2DgR0d1mAwoaYCFYSvSTZM",
    title: "Your Next Five Moves",
    bookAuthors: "Patrick Bet-David",
    formats: {"MP3": {"folderId": "1TSx1TSZQQF9LMob9pwPCqM-vrZqPpgUG", "fileCount": 1}},
  },
];
