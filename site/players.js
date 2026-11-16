// FGT 2027 point values and page layout.
// Source: pgatour.com FedExCup standings (ranks 1-50: final 2026 season; 51+: FedExCup Fall),
// DP World Tour Race to Dubai (Nov 9, 2026), FedExCup Fall projected standings after the Austin Championship (Nov 16, 2026), and the final 2026 Korn Ferry Tour points list.
// Tiers: rank 1-10 = 6, 11-35 = 5, 36-60 = 4, 61-80 = 3, 81-100 = 2, everyone else = 1.
// PROVISIONAL until the RSM Classic ends (Sun Nov 22, 2026). Set provisional:false once finalized.
//
// Layout: three columns of sections, shown top to bottom. "more" holds the remaining 1-pointers,
// shown in a collapsed list below the columns (still searchable). Any golfer not listed is a 1-pointer
// via the write-in box.
window.FGT_DATA = {
  season: 2027,
  provisional: true,
  budget: 25,
  // Hover/focus popups keyed by golfer name.
  tips: {
    // Text between _underscores_ is underlined; \n starts a new line.
    "Danny Willett": "That's\n\"_Masters Champion_ Danny Willett\"\nto you"
  },
  columns: [
    [
      { points: 6, label: "6-pointers", note: "Top 10", players: [
        "Scottie Scheffler", "Viktor Hovland", "Ryan Gerard", "Ludvig Åberg", "Jacob Bridgeman",
        "Alex Fitzpatrick", "Chris Gotterup", "Russell Henley", "Rory McIlroy", "Min Woo Lee"
      ]},
      { points: 5, label: "5-pointers", note: "Ranks 11-35", players: [
        "Tommy Fleetwood", "Adam Scott", "Cameron Young", "Tom Kim", "Collin Morikawa",
        "Xander Schauffele", "Si Woo Kim", "Akshay Bhatia", "Sam Burns", "Justin Rose",
        "Patrick Cantlay", "Wyndham Clark", "Matt Fitzpatrick", "Hideki Matsuyama", "Kristoffer Reitan",
        "Ryan Fox", "Alex Smalley", "Robert MacIntyre", "Gary Woodland", "J.J. Spaun",
        "Kurt Kitayama", "J.T. Poston", "Rickie Fowler", "Bud Cauley", "Nicolai Højgaard"
      ]},
      { points: 4, label: "4-pointers", note: "Ranks 36-50", players: [
        "Alex Noren", "Sungjae Im", "Jake Knapp", "Aaron Rai", "Sepp Straka",
        "Ben Griffin", "Maverick McNealy", "Justin Thomas", "Michael Thorbjornsen", "Nico Echavarria",
        "Michael Brennan", "Ryo Hisatsune", "Sahith Theegala", "Eric Cole", "Matt McCarty"
      ]}
    ],
    [
      { points: 4, label: "4-pointers (cont.)", note: "Fall ranks 51-60", players: [
        "Austin Smotherman", "Keith Mitchell", "Ben James", "Andrew Novak", "Blades Brown",
        "Jordan Smith", "Michael Kim", "Steven Fisk", "Pierceson Coody", "Max Homa"
      ]},
      { points: 3, label: "3-pointers", note: "Ranks 61-80", players: [
        "Ben Kohles", "Doug Ghim", "Harry Hall", "Corey Conners", "Jordan Spieth",
        "Sudarshan Yellamaraju", "Seamus Power", "Chad Ramey", "Harris English", "Ricky Castillo",
        "Brian Harman", "Sam Stevens", "Jackson Koivun", "Kristoffer Ventura", "Nick Taylor",
        "Daniel Berger", "Patrick Rodgers", "Johnny Keefer", "Denny McCarthy", "Shane Lowry"
      ]},
      { points: 2, label: "2-pointers", note: "Ranks 81-100", players: [
        "Stephan Jaeger", "Mac Meissner", "Zach Bauchou", "Beau Hossler", "Aldrich Potgieter",
        "Jackson Suber", "Trace Crowe", "Matti Schmid", "Tom Hoge", "Andrew Putnam",
        "Max Greyserman", "Kevin Yu", "Kevin Roy", "Keegan Bradley", "Matt Wallace",
        "John Parry", "David Lipsky", "Taylor Moore", "Davis Thompson", "Christiaan Bezuidenhout"
      ]}
    ],
    [
      { points: 1, label: "1-pointers", note: "Ranks 101+", players: [
        "Jon Rahm", "Bryson DeChambeau", "Tyrrell Hatton", "Patrick Reed", "Billy Horschel",
        "Chandler Phillips", "Jason Day", "A.J. Ewart", "Lee Hodges", "Rasmus Neergaard-Petersen",
        "Chris Kirk", "Mackenzie Hughes", "Taylor Pendrith", "Brandt Snedeker", "Rico Hoey",
        "Chandler Blanchet", "Emiliano Grillo", "Tony Finau", "Brooks Koepka", "David Ford",
        "Lucas Glover", "Zecheng Dou", "Zac Blair", "Marco Penge", "Ben Silverman"
      ]},
      { points: 1, label: "Korn Ferry Tour top 20", note: "2026 final points list, 1 point each (Blades Brown, KFT #9, is a 4-pointer)", players: [
        "Ross Steelman", "Sandy Scott", "Ian Holt", "Alistair Docherty", "Alvaro Ortiz",
        "Austin Hitt", "Cole Sherwood", "Doc Redman", "Tommy Morrison", "Cooper Dossey",
        "Hunter Eichhorn", "Dylan Menante", "Michael Johnson", "Jeremy Gandon", "Taylor Dickson",
        "Ian Gilligan", "Davis Shore", "Carson Young", "Davis Lamb"
      ]}
    ]
  ],
  more: { points: 1, label: "More 1-pointers", note: "Everyone else we list. Any golfer not shown is also a 1-pointer: use the write-in box.", players: [
    "Rasmus Højgaard", "Neal Shipley", "Austin Eckroat", "Adrien Dumont de Chassart", "Davis Riley",
    "Luke Clanton", "Keita Nakajima", "Max McGreevy", "Jesper Svensson", "Haotong Li",
    "Matthieu Pavon", "William Mouw", "Kensei Hirata", "Mark Hubbard", "Joel Dahmen",
    "Gordon Sargent", "Brice Garnett", "Karl Vilips", "Erik van Rooyen", "Hayden Springer",
    "David Skinns", "Takumi Kanaya", "Kevin Streelman", "S.H. Kim", "Davis Chatfield",
    "Danny Walker", "Pontus Nyholm", "Peter Malnati", "Hank Lebioda", "Jimmy Stanger",
    "Paul Peterson", "Brian Campbell", "Patrick Fishburn", "Jhonattan Vegas", "John VanDerLaan",
    "Dylan Wu", "Dan Brown", "Matt Kuchar", "Chan Kim", "Isaiah Salinda",
    "Ben Martin", "Patton Kizzire", "Justin Lower", "Nick Dunlap", "Joe Highsmith",
    "Sam Ryder", "Cam Davis", "Alejandro Tosti", "Aaron Wise", "Vince Whaley",
    "Sami Valimaki", "Garrick Higgo", "Rafael Campos", "Adam Schenk", "Adam Hadwin",
    "Jeffrey Kang", "Lanto Griffin", "Tyler Duncan", "Webb Simpson", "Thorbjørn Olesen",
    "Adam Svensson", "S.Y. Noh", "Will Gordon", "Zach Johnson", "Troy Merritt",
    "Harry Higgs", "Adrien Saddier", "Jeremy Paul", "Francesco Molinari", "Greyson Sigg",
    "Danny Willett", "Padraig Harrington", "Nick Hardy", "Will Zalatoris", "Luke List",
    "Jonathan Byrd", "Camilo Villegas", "Martin Laird", "Christo Lamprecht", "Fabián Gómez",
    "Marcelo Rozo", "Ryan Brehm", "Cameron Champ", "Vijay Singh", "Emilio Gonzalez",
    "Robert Streb", "Henrik Norlander", "Brendon Todd", "S.T. Lee", "Charley Hoffman",
    "Luke Donald", "Taylor Montgomery", "Dylan Frittelli", "Frankie Capan III", "Austin Cook",
    "Bill Haas", "Chez Reavie", "Michael Thompson", "James Hahn", "Nicholas Lindheim",
    "William McGirt", "Eugenio Chacarra", "Casey Jarvis", "Jayden Schaper", "Daniel Hillier",
    "Jacob Skov Olesen", "Bernd Wiesberger", "Andy Sullivan", "Oliver Lindell", "Joe Dean",
    "Angel Ayora", "Nacho Elvira", "Angel Hidalgo", "David Puig", "Hennie du Plessis",
    "Adrian Meronk", "Dan Bradbury", "Francesco Laporta", "Shaun Norris", "Davis Bryant",
    "Thriston Lawrence", "Marcus Armitage", "Calum Hill"
  ]}
};
