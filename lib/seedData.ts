import type { Level, Role } from "./types";

/** Week 1 runs Jun 22-26, 2025. All seed dates use this year. */
export const WEEK1_YEAR = 2025;
export const WEEK1_NUMBER = 1;
export const WEEK1 = {
  week_number: 1,
  start_date: "2025-06-22",
  end_date: "2025-06-26",
  label: "Week 1 · Jun 22–26",
};

export const TIME_SLOTS: Record<string, { start: string; end: string }> = {
  "4:30": { start: "16:30:00", end: "17:00:00" },
  "5:00": { start: "17:00:00", end: "17:30:00" },
  "5:30": { start: "17:30:00", end: "18:00:00" },
};
export const ALL_SLOTS = ["4:30", "5:00", "5:30"] as const;

/** Maps a day-of-month (22-26) to its ISO date in Week 1. */
export function week1Date(day: number): string {
  return `2025-06-${String(day).padStart(2, "0")}`;
}

export interface SeedInstructor {
  name: string;
  slug: string;
  role: Role;
}

export const instructors: SeedInstructor[] = [
  { name: "Hila Zahedianfard", slug: "hila-zahedianfard", role: "instructor" },
  { name: "Karina Ward", slug: "karina-ward", role: "instructor" },
  { name: "Maya Rosales", slug: "maya-rosales", role: "instructor" },
  { name: "Ellie Pizer", slug: "ellie-pizer", role: "instructor" },
  { name: "Quinn Kearns", slug: "quinn-kearns", role: "instructor" },
  { name: "Lanie Escobar", slug: "lanie-escobar", role: "instructor" },
  { name: "Ethan Garrett", slug: "ethan-garrett", role: "instructor" },
  { name: "Bella Gonzalez", slug: "bella-gonzalez", role: "instructor" },
  { name: "Abbey Higgens", slug: "abbey-higgens", role: "instructor" },
  { name: "Kailey Hunter", slug: "kailey-hunter", role: "instructor" },
  { name: "Aileen Ko", slug: "aileen-ko", role: "instructor" },
  { name: "Akira Kokate", slug: "akira-kokate", role: "instructor" },
  { name: "Ashley B", slug: "ashley-b", role: "instructor" },
  { name: "Nicholas Kouzmanoff", slug: "nicholas-kouzmanoff", role: "instructor" },
  { name: "Malia Apor", slug: "malia-apor", role: "guard" },
  { name: "Renata Lopez", slug: "renata-lopez", role: "guard" },
  { name: "Grace MacInnis", slug: "grace-macinnis", role: "instructor" },
  { name: "Caiman Maloch", slug: "caiman-maloch", role: "instructor" },
  { name: "Katherine Marley", slug: "katherine-marley", role: "instructor" },
  { name: "Lucas Nirk", slug: "lucas-nirk", role: "instructor" },
  { name: "Kate Warner", slug: "kate-warner", role: "instructor" },
  { name: "Megan Zelhart", slug: "megan-zelhart", role: "instructor" },
  { name: "Drew Zane", slug: "drew-zane", role: "instructor" },
  { name: "Kenzie Chua", slug: "kenzie-chua", role: "instructor" },
  { name: "Drew Friscancho", slug: "drew-friscancho", role: "instructor" },
];

export interface SeedStudent {
  last: string;
  first: string;
  gender: string | null;
  age: number | null;
  level: Level;
  goals: string;
  special_needs?: boolean;
}

export const students: SeedStudent[] = [
  { last: "Aguilar", first: "Charlotte", gender: "Female", age: 4, level: "Non-Swimmer", goals: "Enjoy being in the water. Float without assistance. The ability to go underwater would be a big accomplishment." },
  { last: "Aguilar", first: "Juliette", gender: "Female", age: 7, level: "Non-Swimmer", goals: "Eliminate fear of swimming, float without assistance, ability to go underwater, and be able to swim with a kickboard if possible." },
  { last: "Altamirano", first: "Sophia", gender: "Female", age: 5, level: "Beginner", goals: "Gain confidence and be swim safe. Enjoy swimming." },
  { last: "Appleberry", first: "Frank", gender: "Male", age: 6, level: "Non-Swimmer", goals: "Frank loves the water but is still adjusting to having water splashed on his face and putting his head underwater." },
  { last: "Bredesen", first: "Barron", gender: "Male", age: 5, level: "Beginner", goals: "Helping to start using arms with strokes." },
  { last: "Bryant", first: "Alfred", gender: "Male", age: 6, level: "Intermediate", goals: "Working on arm strokes and kicks at the same time, side breathing, back float." },
  { last: "Burgoon", first: "Johnny", gender: "Male", age: 6, level: "Beginner", goals: "Improve his strokes. Parent note: last year Johnny's coach was Steven and he was wonderful. If he is back they would love to be paired with him again." },
  { last: "Caric", first: "Quinn", gender: "Female", age: 4, level: "Beginner", goals: "Comfort in the water and having water on face. Pool safety." },
  { last: "De La Cruz", first: "Gavin", gender: "Male", age: 5, level: "Non-Swimmer", goals: "Become water safe." },
  { last: "Di Pietra", first: "Julian", gender: "Male", age: 6, level: "Beginner", goals: "Build on skills learned last summer. Water safety." },
  { last: "Di Pietra", first: "Matteo", gender: "Male", age: 6, level: "Beginner", goals: "Build on skills learned last summer. Water safety." },
  { last: "Egertson", first: "Ellis", gender: "Male", age: 7, level: "Non-Swimmer", special_needs: true, goals: "Ellis has mild autism spectrum disorder. He is completely verbal and loves being in the pool. First goal: get comfortable holding breath and going completely underwater for 10 or more seconds. Then swim a short distance. Worked with Josh Scaglione last year and it was a great fit. Instructors with ASD experience preferred." },
  { last: "Elkins", first: "Maxwell", gender: "Male", age: 8, level: "Intermediate", goals: "Stronger swimming skills." },
  { last: "Fujii-Wong", first: "Mackenzie", gender: "Female", age: 6, level: "Non-Swimmer", goals: "Continue learning to swim and gain confidence without floaties. Mackenzie is shy but will trust her instructor with some time." },
  { last: "Gambin", first: "Harrison", gender: "Male", age: 8, level: "Beginner", goals: "Freestyle." },
  { last: "Greenway", first: "Landon", gender: "Male", age: 5, level: "Beginner", goals: "Water safe." },
  { last: "Guerra-Genc", first: "Blythe", gender: "Female", age: 14, level: "Intermediate", special_needs: true, goals: "Continue developing swimming abilities. Has ADHD and needs practice and reinforcement. Learn to swim fluidly. Important: Blythe does not like sweets — ice cream analogies do not work. Savory foods like pizza work fine instead." },
  { last: "Han", first: "Colin", gender: "Male", age: 4, level: "Non-Swimmer", goals: "Get used to water, learn one stroke, have fun." },
  { last: "Hessick", first: "Delbert", gender: "Male", age: 10, level: "Intermediate", goals: "Gain ability to swim multiple laps. Work on endurance while honing stroke form. Consistently breathe from only one side during freestyle." },
  { last: "Hinkle", first: "Hudson", gender: "Male", age: 5, level: "Beginner", goals: "Water safety as a lifesaving skill. Master basic water safety and swimming skills then move to basic swimming strokes." },
  { last: "Horner", first: "Michael", gender: "Male", age: 4, level: "Beginner", goals: "Has been relying on floaties and has a fear of getting water in his eyes. Goals: dog paddle on his own and get comfortable with getting his face wet." },
  { last: "Huskins", first: "Cameron", gender: "Male", age: 4, level: "Non-Swimmer", goals: "" },
  { last: "Huskins", first: "Jeffrey", gender: "Male", age: 7, level: "Beginner", goals: "" },
  { last: "Imamura", first: "Fernando", gender: "Male", age: 7, level: "Beginner", goals: "Be able to swim on his own." },
  { last: "Kalem", first: "Sofia", gender: "Female", age: 22, level: "Beginner", special_needs: true, goals: "High-functioning special needs young adult. Athletic and participates in adapted sports. Needs a patient instructor who understands special needs communication and is very encouraging. Has had successful lessons before but her instructor retired. Goal: revisit skills and learn additional strokes with proper breathing." },
  { last: "Keith", first: "Lucas", gender: "Male", age: 5, level: "Non-Swimmer", goals: "" },
  { last: "Lee", first: "Ian", gender: "Male", age: 9, level: "Intermediate", goals: "Better stamina. Swimming laps if possible." },
  { last: "Liao", first: "Alexander", gender: "Male", age: 8, level: "Intermediate", goals: "Treading water, freestyle stroke clinic." },
  { last: "Locke", first: "Casey", gender: "Male", age: 5, level: "Non-Swimmer", goals: "Water safety and confidence to swim on his own without assistance." },
  { last: "Louvet", first: "Camille", gender: "Female", age: 4, level: "Non-Swimmer", goals: "Feel comfortable in the water and be water-safe. Float on her back if she falls in." },
  { last: "Lovrich", first: "Grace", gender: "Female", age: 7, level: "Beginner", goals: "Continue swim lessons. Parent preference: Ava or Maya R. if available." },
  { last: "Ly", first: "Evan", gender: "Male", age: 9, level: "Beginner", goals: "Be able to swim." },
  { last: "Lynch", first: "Lincoln", gender: "Male", age: 5, level: "Non-Swimmer", goals: "" },
  { last: "Mak", first: "Elizabeth", gender: "Female", age: 7, level: "Beginner", goals: "Be water safe, know how to float, and make it to the side of the pool." },
  { last: "Martinek", first: "Logan", gender: "Male", age: 5, level: "Beginner", goals: "Water safe, able to swim." },
  { last: "Park", first: "Luna", gender: "Female", age: 4, level: "Non-Swimmer", goals: "" },
  { last: "Pato", first: "Ellis", gender: "Male", age: 10, level: "Intermediate", goals: "Become a stronger swimmer. Currently doggy paddling and going underwater rather than actually swimming. Learn proper strokes." },
  { last: "Pousson", first: "Gregory", gender: "Male", age: 5, level: "Beginner", goals: "Swim more confidently." },
  { last: "Presley", first: "Brooke", gender: "Female", age: 5, level: "Beginner", goals: "Learn proper breathing, build basic floating skills, and develop simple stroke technique." },
  { last: "Rasooli", first: "Shaheen", gender: "Male", age: 6, level: "Non-Swimmer", goals: "To learn how to swim." },
  { last: "Reese", first: "Violet", gender: "Female", age: 10, level: "Intermediate", goals: "Continue to get more comfortable swimming in the deep end." },
  { last: "Richelieu", first: "Rian", gender: "Male", age: 3, level: "Beginner", goals: "Confidence in the water and ability to swim on his own." },
  { last: "Riggs", first: "Blair", gender: "Female", age: 4, level: "Non-Swimmer", goals: "Did weekly swim for a year but not progressing. Hoping 3 to 4 weeks straight helps. Goal: comfortable in the water and trying to swim." },
  { last: "Saba", first: "Ellie", gender: "Female", age: 5, level: "Non-Swimmer", goals: "Become comfortable putting her face in the water and excited or at least comfortable about the idea of learning to swim." },
  { last: "Saba", first: "Colin", gender: "Male", age: null, level: "Non-Swimmer", goals: "Sibling of Ellie Saba. Shares lesson slot." },
  { last: "Sanjabi", first: "Aliesa", gender: "Female", age: 8, level: "Intermediate", goals: "Strengthen swim capabilities and be able to swim back and forth numerous times." },
  { last: "Sanjabi", first: "Ariya", gender: "Male", age: 4, level: "Beginner", goals: "Learn how to swim from one side of the pool to the other." },
  { last: "Sapien", first: "Ellie", gender: "Female", age: 7, level: "Beginner", goals: "Start learning strokes." },
  { last: "Shah", first: "Sarah", gender: "Female", age: 21, level: "Beginner", special_needs: true, goals: "Get comfortable in water, more coordinated swimming, develop stamina for a lap." },
  { last: "Spaulding", first: "Georgia", gender: "Female", age: 4, level: "Non-Swimmer", goals: "Learning to swim." },
  { last: "Sutton", first: "Isabella", gender: "Female", age: 6, level: "Beginner", goals: "Ability to swim independently without floats." },
  { last: "Sutton", first: "Matteo", gender: "Male", age: 4, level: "Beginner", goals: "Ability to swim independently without floats." },
  { last: "Sutton", first: "Milana", gender: "Female", age: 6, level: "Beginner", goals: "Ability to swim independently without floats." },
  { last: "Tolhurst", first: "Aleyah", gender: "Female", age: 8, level: "Intermediate", goals: "Proper strokes." },
  { last: "Tsai", first: "David", gender: "Male", age: 6, level: "Beginner", goals: "Be able to submerge head underwater and do basic swimming without floaties under adult supervision." },
  { last: "Tsai", first: "Elise", gender: "Female", age: 4, level: "Beginner", goals: "Fully submerge underwater and be very comfortable in water. Swim fairly independently, OK with kickboard or teaching bar." },
  { last: "Wigdahl", first: "Micah", gender: "Male", age: 13, level: "Beginner", goals: "Can manage in pool by pushing off the bottom but needs strokes. Focus on freestyle, breaststroke, and treading water." },
  { last: "Wojcicki", first: "Leo", gender: "Male", age: 4, level: "Non-Swimmer", goals: "Passed survivor test at South Bay Aquatics and can fall in and float. Regression after instructor change. Has some fear of water and putting face in. Goal: swim on his own." },
  { last: "Wojcicki", first: "Somi", gender: "Female", age: 6, level: "Beginner", goals: "Began freestyle before leaving South Bay Aquatics. Has not swum in 6 months so there may be some regression. Goal: more confidence and learning more strokes." },
  { last: "Yang", first: "Lauren", gender: "Female", age: 11, level: "Beginner", goals: "Can swim but has never had lessons. Learn skills and master freestyle." },
];

export interface SeedLesson {
  instructor: string; // instructor name
  day: number; // 22-26
  slot: "4:30" | "5:00" | "5:30";
  students: string[]; // full names
}

/** Helper to build repeated lessons across multiple days for one student/pair. */
function days(
  instructor: string,
  slot: SeedLesson["slot"],
  dayList: number[],
  students: string[]
): SeedLesson[] {
  return dayList.map((day) => ({ instructor, slot, day, students }));
}

export const week1Lessons: SeedLesson[] = [
  // Hila Zahedianfard
  { instructor: "Hila Zahedianfard", day: 22, slot: "4:30", students: ["David Tsai"] },
  { instructor: "Hila Zahedianfard", day: 24, slot: "5:00", students: ["David Tsai"] },
  { instructor: "Hila Zahedianfard", day: 25, slot: "5:00", students: ["David Tsai"] },
  // Karina Ward
  ...days("Karina Ward", "4:30", [22, 24, 25], ["Lincoln Lynch"]),
  ...days("Karina Ward", "5:00", [24, 25], ["Johnny Burgoon"]),
  // Ellie Pizer
  ...days("Ellie Pizer", "4:30", [22, 23, 24, 25, 26], ["Julian Di Pietra"]),
  { instructor: "Ellie Pizer", day: 25, slot: "5:00", students: ["Camille Louvet"] },
  { instructor: "Ellie Pizer", day: 22, slot: "5:30", students: ["Ariya Sanjabi"] },
  // Quinn Kearns
  ...days("Quinn Kearns", "4:30", [22, 23, 24, 25, 26], ["Charlotte Aguilar", "Juliette Aguilar"]),
  ...days("Quinn Kearns", "5:30", [22, 24], ["Delbert Hessick"]),
  // Lanie Escobar
  { instructor: "Lanie Escobar", day: 22, slot: "4:30", students: ["Elise Tsai"] },
  { instructor: "Lanie Escobar", day: 23, slot: "4:30", students: ["Quinn Caric"] },
  { instructor: "Lanie Escobar", day: 24, slot: "4:30", students: ["Milana Sutton"] },
  { instructor: "Lanie Escobar", day: 25, slot: "4:30", students: ["Quinn Caric"] },
  ...days("Lanie Escobar", "5:00", [24, 25], ["Elise Tsai"]),
  // Bella Gonzalez
  ...days("Bella Gonzalez", "4:30", [22, 23, 24, 25, 26], ["Matteo Di Pietra"]),
  ...days("Bella Gonzalez", "5:00", [24, 26], ["Shaheen Rasooli"]),
  { instructor: "Bella Gonzalez", day: 22, slot: "5:30", students: ["Aliesa Sanjabi"] },
  // Abbey Higgens
  { instructor: "Abbey Higgens", day: 24, slot: "4:30", students: ["Isabella Sutton"] },
  { instructor: "Abbey Higgens", day: 25, slot: "4:30", students: ["Aleyah Tolhurst"] },
  { instructor: "Abbey Higgens", day: 25, slot: "5:00", students: ["Cameron Huskins"] },
  // Kailey Hunter
  ...days("Kailey Hunter", "4:30", [22, 24], ["Evan Ly"]),
  ...days("Kailey Hunter", "4:30", [23, 25], ["Maxwell Elkins"]),
  ...days("Kailey Hunter", "5:00", [23, 24, 25], ["Fernando Imamura"]),
  // Akira Kokate
  { instructor: "Akira Kokate", day: 26, slot: "4:30", students: ["Colin Han"] },
  // Ashley B
  ...days("Ashley B", "4:30", [23, 24, 25], ["Georgia Spaulding"]),
  // Nicholas Kouzmanoff
  ...days("Nicholas Kouzmanoff", "4:30", [22, 24, 26], ["Harrison Gambin"]),
  // Grace MacInnis
  { instructor: "Grace MacInnis", day: 24, slot: "4:30", students: ["Rian Richelieu"] },
  { instructor: "Grace MacInnis", day: 23, slot: "5:00", students: ["Rian Richelieu"] },
  // Caiman Maloch
  ...days("Caiman Maloch", "4:30", [22, 23, 24, 25, 26], ["Gavin De La Cruz"]),
  // Katherine Marley
  { instructor: "Katherine Marley", day: 22, slot: "4:30", students: ["Leo Wojcicki", "Somi Wojcicki"] },
  { instructor: "Katherine Marley", day: 23, slot: "4:30", students: ["Ellie Sapien"] },
  { instructor: "Katherine Marley", day: 22, slot: "5:00", students: ["Sofia Kalem"] },
  { instructor: "Katherine Marley", day: 23, slot: "5:00", students: ["Leo Wojcicki", "Somi Wojcicki"] },
  { instructor: "Katherine Marley", day: 24, slot: "5:00", students: ["Sofia Kalem"] },
  // Lucas Nirk
  ...days("Lucas Nirk", "4:30", [22, 25], ["Landon Greenway"]),
  ...days("Lucas Nirk", "4:30", [24, 26], ["Hudson Hinkle"]),
  { instructor: "Lucas Nirk", day: 25, slot: "5:00", students: ["Jeffrey Huskins"] },
  // Megan Zelhart
  ...days("Megan Zelhart", "4:30", [22, 24, 25], ["Ellie Saba", "Colin Saba"]),
];

export interface SeedUnavailable {
  instructor: string;
  days: number[];
  slots: ("4:30" | "5:00" | "5:30")[];
}

const ALL: ("4:30" | "5:00" | "5:30")[] = ["4:30", "5:00", "5:30"];

export const week1Unavailable: SeedUnavailable[] = [
  { instructor: "Hila Zahedianfard", days: [26], slots: ALL },
  { instructor: "Aileen Ko", days: [22, 24, 26], slots: ALL },
  { instructor: "Malia Apor", days: [22, 23, 24, 25, 26], slots: ALL },
  { instructor: "Renata Lopez", days: [23, 25], slots: ALL },
  { instructor: "Kate Warner", days: [22, 23], slots: ALL },
  { instructor: "Drew Zane", days: [23, 25], slots: ALL },
  { instructor: "Drew Zane", days: [22, 24], slots: ["5:30"] },
  { instructor: "Kenzie Chua", days: [23, 26], slots: ALL },
  { instructor: "Drew Friscancho", days: [22, 23, 24, 25, 26], slots: ALL },
  { instructor: "Ashley B", days: [22, 26], slots: ALL },
  { instructor: "Lanie Escobar", days: [26], slots: ALL },
  { instructor: "Abbey Higgens", days: [26], slots: ALL },
  { instructor: "Grace MacInnis", days: [25, 26], slots: ALL },
  { instructor: "Katherine Marley", days: [25, 26], slots: ALL },
  { instructor: "Lucas Nirk", days: [22, 23, 24, 25, 26], slots: ["5:30"] },
];
